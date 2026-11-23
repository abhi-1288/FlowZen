import { randomBytes } from "crypto";
import os from "os";
import mongoose from "mongoose";
import { connectDb } from "./db";

/**
 * Event Hub for Server-Sent Events (SSE).
 *
 * Each app instance keeps its own map of user IDs to the stream controllers it
 * is holding open. That part is process-local by definition (an SSE stream
 * lives on exactly one instance).
 *
 * To run more than one instance behind a load balancer, events and presence
 * must be shared between them. We do that with MongoDB instead of introducing
 * another service:
 *
 *  - Every emitted event is written to the short-lived `realtimeevents`
 *    collection. Each instance tails that collection with a change stream and
 *    delivers events addressed to users connected to it. Emitting instances
 *    deliver locally straight away and skip their own change stream echo, so
 *    the common single-user path stays in-process with no added latency.
 *  - Each instance heartbeats the users connected to it into the
 *    `realtimepresence` collection, so "is this user online anywhere?" can be
 *    answered across replicas. Documents expire via a TTL index, so an
 *    instance that crashes cannot leave users stuck "online".
 *
 * If the database is a standalone MongoDB (change streams need a replica set)
 * fan-out is disabled automatically and everything behaves as before: local
 * delivery only. Set `REALTIME_FANOUT=on` in development to exercise the
 * distributed path, `off` to force local-only in production.
 */

const EVENTS_COLLECTION = "realtimeevents";
const PRESENCE_COLLECTION = "realtimepresence";
const EVENT_TTL_SECONDS = 120;
const PRESENCE_TTL_SECONDS = 60;
const PRESENCE_HEARTBEAT_MS = 15_000;
const PRESENCE_STALE_MS = PRESENCE_HEARTBEAT_MS * 3;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

type EventDoc = {
  origin: string;
  // One document can address many users so a board-wide broadcast costs a
  // single write instead of one per member.
  targets: string[];
  event: string;
  payload: unknown;
  createdAt: Date;
};

type PresenceDoc = {
  _id: string;
  users: string[];
  updatedAt: Date;
};

const fanoutSetting = (process.env.REALTIME_FANOUT ?? "").toLowerCase();
const fanoutEnabled = fanoutSetting === "on"
  ? true
  : fanoutSetting === "off"
    ? false
    : process.env.NODE_ENV === "production";

// An instance id must be unique per process, otherwise two replicas would
// ignore each other's events. It is stored on `globalThis` because Next bundles
// each route separately: a module-scoped id would differ per route within the
// same process, so the emitting bundle's events would be replayed by another
// bundle's change stream (duplicate notifications) and presence would show the
// same process several times. `INSTANCE_ID` is supported as a prefix for logs.
const globalInstance = globalThis as unknown as { realtimeInstanceId?: string };
const INSTANCE_ID =
  globalInstance.realtimeInstanceId ??=
  `${process.env.INSTANCE_ID?.trim() || "flowzen"}:${os.hostname()}:${process.pid}:${randomBytes(4).toString("hex")}`;

class EventHub {
  private static instance: EventHub;
  private clients: Map<string, Set<ReadableStreamDefaultController>> = new Map();
  private localUsers: Set<string> = new Set();
  private encoder = new TextEncoder();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private presenceFlushTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): EventHub {
    if (!EventHub.instance) {
      EventHub.instance = new EventHub();
    }
    return EventHub.instance;
  }

  public subscribe(userId: string, controller: ReadableStreamDefaultController) {
    let userClients = this.clients.get(userId);
    if (!userClients) {
      userClients = new Set();
      this.clients.set(userId, userClients);
    }
    userClients.add(controller);
    this.localUsers.add(userId);

    this.schedulePresenceFlush();
    void startFanout();
  }

  public unsubscribe(userId: string, controller: ReadableStreamDefaultController) {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    userClients.delete(controller);
    if (userClients.size === 0) {
      this.clients.delete(userId);
      this.localUsers.delete(userId);
      this.schedulePresenceFlush();
    }
  }

  public hasSubscriber(userId: string): boolean {
    return (this.clients.get(userId)?.size ?? 0) > 0;
  }

  /** Deliver only to streams held by this process. */
  public deliverLocal(userId: string, event: string, data: unknown) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const controller of [...userClients]) {
      try {
        controller.enqueue(this.encoder.encode(payload));
      } catch {
        // Client disconnected between the check and the write.
        this.unsubscribe(userId, controller);
      }
    }
  }

  public emit(userId: string, event: string, data: unknown) {
    this.emitMany([userId], event, data);
  }

  public emitMany(userIds: string[], event: string, data: unknown) {
    const targets = [...new Set(userIds.filter(Boolean))];
    if (targets.length === 0) return;

    for (const userId of targets) {
      this.deliverLocal(userId, event, data);
    }
    void this.publish(targets, event, data);
  }

  private async publish(targets: string[], event: string, payload: unknown) {
    if (!fanoutEnabled || !runtime.supported) return;
    try {
      await connectDb();
      const db = mongoose.connection.db;
      if (!db) return;
      await db.collection<EventDoc>(EVENTS_COLLECTION).insertOne({
        origin: INSTANCE_ID,
        targets,
        event,
        payload,
        createdAt: new Date(),
      });
    } catch {
      // Fan-out is best-effort. Local delivery already happened, and a retry
      // queue for ephemeral notifications would be more failure modes than it
      // is worth.
    }
  }

  public startPresenceHeartbeat() {
    if (!fanoutEnabled || this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => void this.flushPresence(), PRESENCE_HEARTBEAT_MS);
    this.heartbeatTimer.unref?.();
    void this.flushPresence();
  }

  private schedulePresenceFlush() {
    if (!fanoutEnabled || this.presenceFlushTimer) return;
    // Coalesce subscribe/unsubscribe bursts (e.g. a page with many tabs) into a
    // single presence write.
    this.presenceFlushTimer = setTimeout(() => {
      this.presenceFlushTimer = null;
      void this.flushPresence();
    }, 250);
    this.presenceFlushTimer.unref?.();
  }

  private async flushPresence() {
    if (!fanoutEnabled || !runtime.supported) return;
    try {
      await connectDb();
      const db = mongoose.connection.db;
      if (!db) return;

      const presence = db.collection<PresenceDoc>(PRESENCE_COLLECTION);
      if (this.localUsers.size === 0) {
        await presence.deleteOne({ _id: INSTANCE_ID });
        return;
      }

      await presence.updateOne(
        { _id: INSTANCE_ID },
        { $set: { users: [...this.localUsers], updatedAt: new Date() } },
        { upsert: true },
      );
    } catch {
      // Presence is advisory; a missed heartbeat heals on the next tick.
    }
  }
}

type RealtimeRuntime = {
  hub: EventHub;
  started: boolean;
  supported: boolean;
  changeStream: { close: () => Promise<void> } | null;
  retryTimer: NodeJS.Timeout | null;
  retries: number;
};

const globalRuntime = globalThis as unknown as { realtimeRuntime?: RealtimeRuntime };

const runtime: RealtimeRuntime =
  globalRuntime.realtimeRuntime ??
  {
    hub: EventHub.getInstance(),
    started: false,
    // Unknown until the first change stream is opened. Publishing before that
    // is fine: the watcher starts at "now" and only consumes new documents.
    supported: fanoutEnabled,
    changeStream: null,
    retryTimer: null,
    retries: 0,
  };

if (!globalRuntime.realtimeRuntime) {
  globalRuntime.realtimeRuntime = runtime;
}

export const eventHub = runtime.hub;

const UNSUPPORTED_CODES = new Set([13, 405, 8000, 8001]);
const UNSUPPORTED_MESSAGE = /only supported on replica sets|change streams are not supported|not authorized to execute/i;

function isUnsupportedError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "number" && UNSUPPORTED_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : "";
  return UNSUPPORTED_MESSAGE.test(message);
}

async function ensureCollections() {
  const db = mongoose.connection.db;
  if (!db) return;

  // TTL indexes keep the event log and dead-instance presence rows bounded;
  // without them a long-lived deployment would grow both collections forever.
  await Promise.all([
    db.collection(EVENTS_COLLECTION)
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: EVENT_TTL_SECONDS })
      .catch(() => {}),
    db.collection(PRESENCE_COLLECTION)
      .createIndex({ updatedAt: 1 }, { expireAfterSeconds: PRESENCE_TTL_SECONDS })
      .catch(() => {}),
    db.collection(PRESENCE_COLLECTION).createIndex({ users: 1 }).catch(() => {}),
  ]);
}

function scheduleReconnect() {
  if (!fanoutEnabled || runtime.retryTimer) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** runtime.retries, RECONNECT_MAX_MS);
  runtime.retries = Math.min(runtime.retries + 1, 8);
  runtime.retryTimer = setTimeout(() => {
    runtime.retryTimer = null;
    void openChangeStream();
  }, delay);
  runtime.retryTimer.unref?.();
}

async function openChangeStream() {
  try {
    await connectDb();
    await ensureCollections();

    const db = mongoose.connection.db;
    if (!db) return;

    const stream = db
      .collection<EventDoc>(EVENTS_COLLECTION)
      .watch([{ $match: { operationType: "insert" } }], { fullDocument: "updateLookup" });

    runtime.changeStream = stream as unknown as RealtimeRuntime["changeStream"];
    runtime.supported = true;
    runtime.retries = 0;

    stream.on("change", (change) => {
      if (change.operationType !== "insert") return;
      const doc = change.fullDocument;
      // The emitting instance already delivered to its own streams.
      if (!doc || doc.origin === INSTANCE_ID || !Array.isArray(doc.targets)) return;
      for (const target of doc.targets) {
        runtime.hub.deliverLocal(target, doc.event, doc.payload);
      }
    });

    stream.on("error", (error) => {
      void runtime.changeStream?.close().catch(() => {});
      runtime.changeStream = null;

      if (isUnsupportedError(error)) {
        // Standalone MongoDB / restricted user: stay local-only rather than
        // reconnecting forever and log-spamming.
        runtime.supported = false;
        console.warn(
          "EventHub: change streams unavailable, SSE fan-out is local-only:",
          error instanceof Error ? error.message : error,
        );
        return;
      }

      scheduleReconnect();
    });
  } catch (error) {
    if (isUnsupportedError(error)) {
      console.warn(
        "EventHub: change streams unavailable, SSE fan-out is local-only:",
        error instanceof Error ? error.message : error,
      );
      return;
    }
    scheduleReconnect();
  }
}

async function startFanout() {
  if (!fanoutEnabled || runtime.started) return;
  runtime.started = true;
  eventHub.startPresenceHeartbeat();
  await openChangeStream();
}

/**
 * True when the user has an open SSE stream on this instance or on any other
 * instance that has heartbeated recently.
 */
export async function isOnlineGlobally(userId: string): Promise<boolean> {
  if (eventHub.hasSubscriber(userId)) return true;
  if (!fanoutEnabled || !runtime.supported) return false;

  try {
    await connectDb();
    const db = mongoose.connection.db;
    if (!db) return false;

    const doc = await db.collection<PresenceDoc>(PRESENCE_COLLECTION).findOne(
      {
        users: userId,
        _id: { $ne: INSTANCE_ID },
        updatedAt: { $gt: new Date(Date.now() - PRESENCE_STALE_MS) },
      },
      { projection: { _id: 1 } },
    );
    return Boolean(doc);
  } catch {
    return false;
  }
}

/** Diagnostics for the health endpoint. */
export function getRealtimeInfo() {
  const fanout = !fanoutEnabled
    ? "disabled"
    : runtime.changeStream
      ? "distributed"
      : runtime.started && !runtime.supported
        ? "local"
        : "idle";

  return { instanceId: INSTANCE_ID, fanout };
}
