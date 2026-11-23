import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { getRealtimeInfo } from "@/lib/event-hub";

export const dynamic = "force-dynamic";

const DB_PING_TIMEOUT_MS = 3_000;

async function pingDatabase() {
  await connectDb();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active database connection.");

  await Promise.race([
    db.admin().ping(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database ping timed out.")), DB_PING_TIMEOUT_MS),
    ),
  ]);
}

/**
 * Load-balancer health probe.
 *
 * `GET /api/health` is a readiness check: it pings MongoDB and reports 503
 * while the database is unreachable, so a replica that cannot serve requests
 * is taken out of rotation instead of accepting them and failing.
 *
 * Deliberately unauthenticated and cheap: a load balancer polls this from
 * every node every few seconds.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await pingDatabase();

    return NextResponse.json(
      {
        status: "ok",
        uptimeSeconds: Math.round(process.uptime()),
        db: "up",
        databaseLatencyMs: Date.now() - startedAt,
        realtime: getRealtimeInfo(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        uptimeSeconds: Math.round(process.uptime()),
        db: "down",
        error: error instanceof Error ? error.message : "Database unreachable.",
        realtime: getRealtimeInfo(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
