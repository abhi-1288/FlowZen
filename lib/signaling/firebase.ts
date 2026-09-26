import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  set,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import {
  SignalingUnavailableError,
  FIREBASE_SIGNAL_ROOT as ROOT_PATH,
  type PeerPresence,
  type SignalMessage,
  type SignalPayload,
  type SignalRole,
  type SignalingClient,
} from "@/lib/signaling/types";

const PEER_ROLE: Record<SignalRole, SignalRole> = {
  candidate: "interviewer",
  interviewer: "candidate",
};

let cachedApp: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase can only be initialised in the browser.");
  }
  if (cachedApp) return cachedApp;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

  if (!apiKey || !databaseURL || !projectId || !appId) {
    throw new SignalingUnavailableError(
      "Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* values to .env.local, or set NEXT_PUBLIC_SIGNALING_PROVIDER=supabase."
    );
  }

  cachedApp = getApps()[0] ?? initializeApp({ apiKey, authDomain, projectId, databaseURL, appId });
  return cachedApp;
}

function getDatabaseOrThrow(): Database {
  try {
    return getDatabase(getFirebaseApp());
  } catch (error) {
    throw new SignalingUnavailableError(
      error instanceof Error ? error.message : "Could not open the Firebase realtime database."
    );
  }
}

function readPayload(value: unknown): (SignalPayload & { from?: SignalRole }) | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind === "offer" || kind === "answer") {
    const sdp = record.sdp as RTCSessionDescriptionInit | undefined;
    if (!sdp || typeof sdp.type !== "string" || typeof sdp.sdp !== "string") return null;
    return { kind, sdp };
  }
  if (kind === "ice") {
    const candidate = record.candidate as RTCIceCandidateInit | undefined;
    if (!candidate || typeof candidate.candidate !== "string") return null;
    return { kind, candidate };
  }
  if (kind === "bye") return { kind };
  return null;
}

export function createFirebaseSignalingClient(): SignalingClient {
  let database: Database | null = null;
  let roomId = "";
  let role: SignalRole = "candidate";
  let displayName = "";
  let unsubscribers: Unsubscribe[] = [];

  const messageHandlers = new Set<(message: SignalMessage) => void>();
  const presenceHandlers = new Set<(presence: PeerPresence) => void>();

  function emitMessage(payload: SignalPayload & { from?: SignalRole; at?: number }) {
    const message: SignalMessage = {
      ...payload,
      from: payload.from ?? PEER_ROLE[role],
      at: payload.at ?? Date.now(),
    };
    messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error("Firebase signaling handler failed:", error);
      }
    });
  }

  function emitPresence(present: boolean, name?: string) {
    const presence: PeerPresence = { present, name };
    presenceHandlers.forEach((handler) => {
      try {
        handler(presence);
      } catch (error) {
        console.error("Firebase presence handler failed:", error);
      }
    });
  }

  function teardown() {
    unsubscribers.forEach((off) => {
      try {
        off();
      } catch {
        // best effort
      }
    });
    unsubscribers = [];
  }

  return {
    async connect(nextRoomId, nextRole, name) {
      if (typeof window === "undefined") {
        throw new SignalingUnavailableError("Signaling can only start in the browser.");
      }

      database = getDatabaseOrThrow();
      const db = database;
      roomId = nextRoomId;
      role = nextRole;
      displayName = name;
      teardown();

      const roomPath = `${ROOT_PATH}/${roomId}`;

      unsubscribers.push(
        onChildAdded(ref(db, `${roomPath}/signal`), (snapshot) => {
          const payload = readPayload(snapshot.val());
          if (payload) emitMessage(payload);
        })
      );

      const peerPresenceRef = ref(db, `${roomPath}/presence/${PEER_ROLE[role]}`);
      unsubscribers.push(
        onValue(
          peerPresenceRef,
          (snapshot) => {
            const value = snapshot.val() as { name?: unknown } | null;
            emitPresence(Boolean(value), typeof value?.name === "string" ? value.name : undefined);
          },
          () => emitPresence(false)
        )
      );

      const ownPresenceRef = ref(db, `${roomPath}/presence/${role}`);
      await set(ownPresenceRef, { name: displayName, onlineAt: Date.now() });
      await onDisconnect(ownPresenceRef).remove();
    },

    async send(payload) {
      if (!database || !roomId) return;
      await push(ref(database, `${ROOT_PATH}/${roomId}/signal`), {
        ...payload,
        from: role,
        at: Date.now(),
      });
    },

    onMessage(handler) {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },

    onPeerPresence(handler) {
      presenceHandlers.add(handler);
      return () => presenceHandlers.delete(handler);
    },

    async disconnect() {
      const activeDb = database;
      const activeRoom = roomId;
      const activeRole = role;
      teardown();
      database = null;
      roomId = "";
      if (!activeDb || !activeRoom) return;
      try {
        await remove(ref(activeDb, `${ROOT_PATH}/${activeRoom}/presence/${activeRole}`));
      } catch {
        // best effort — the connection may already be gone
      }
    },
  };
}
