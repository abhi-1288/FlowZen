import {
  FIREBASE_SIGNAL_ROOT,
  getSignalingProvider,
  type SignalingProviderName,
} from "@/lib/signaling/types";

/**
 * Server-side cleanup of a room's signalling data, for when an interview reaches
 * a terminal state (feedback submitted, or cancelled).
 *
 * Why this exists differs sharply by provider:
 *
 *  - Firebase persists every offer, answer, ICE candidate and `bye` under
 *    `flowzen-signals/<roomId>` via `push()`, and nothing else ever deletes them.
 *    The room id is the interview's `videoRoomTokenHash`, so it is stable per
 *    interview and that data otherwise sits in the database forever — including
 *    the local network candidates carried in SDP and ICE.
 *  - Supabase Realtime **Broadcast** is ephemeral pub/sub with no table behind
 *    it, so there is genuinely nothing stored to remove. The only retained state
 *    is presence, which lives on the Phoenix channel and is released by the
 *    client calling `disconnect()`.
 *
 * Everything here is best effort by design. A cleanup failure must never fail the
 * request that triggered it — losing an interview's feedback matters, losing a
 * stale signalling node does not.
 */

export type PurgeResult = {
  provider: SignalingProviderName;
  purged: boolean;
  /** Why nothing was deleted, or how it went, for logging. */
  detail: string;
};

const REQUEST_TIMEOUT_MS = 5000;

function firebaseDatabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "").trim().replace(/\/+$/, "");
}

/**
 * Room ids are sha256 hex, so they are already URL-safe. The `.json` suffix and
 * the shallow flag are Firebase REST conventions.
 */
function roomUrl(roomId: string, shallow = false): string {
  const base = `${firebaseDatabaseUrl()}/${FIREBASE_SIGNAL_ROOT}/${roomId}.json`;
  return shallow ? `${base}?shallow=true` : base;
}

/**
 * Room keys that currently have data in the Realtime Database. One shallow read
 * of the root, so a backfill can intersect against real keys instead of issuing
 * a pointless DELETE per historical interview.
 */
export async function listFirebaseRoomIds(): Promise<string[]> {
  const base = firebaseDatabaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_FIREBASE_DATABASE_URL is not configured.");

  const response = await fetch(`${base}/${FIREBASE_SIGNAL_ROOT}.json?shallow=true`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Realtime Database responded ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as Record<string, unknown> | null;
  return body ? Object.keys(body) : [];
}

/**
 * Delete a room's signalling data. Never throws.
 *
 * No credentials are sent. The browser client is unauthenticated — a candidate
 * only ever holds an invitation token and never signs in to Firebase — so the
 * Realtime Database rules must already permit anonymous access to this path, and
 * this request behaves the same way. If the rules are stricter the delete is
 * refused and reported through `detail` rather than raised.
 */
export async function purgeSignalingRoom(
  roomId: string | null | undefined,
  provider: SignalingProviderName = getSignalingProvider()
): Promise<PurgeResult> {
  if (!roomId) {
    return { provider, purged: false, detail: "No signalling room token on this interview." };
  }

  if (provider !== "firebase") {
    return {
      provider,
      purged: false,
      detail:
        "Realtime Broadcast is not persisted, so there is nothing to delete. Presence is released when the client disconnects.",
    };
  }

  if (!firebaseDatabaseUrl()) {
    return { provider, purged: false, detail: "NEXT_PUBLIC_FIREBASE_DATABASE_URL is not configured." };
  }

  try {
    const response = await fetch(roomUrl(roomId), {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Usually security rules. Worth surfacing loudly, since it means the
      // Realtime Database is readable/writable per-origin but not from the server.
      console.warn(
        `[signaling] Could not purge room ${roomId}: Realtime Database responded ${response.status} ${response.statusText}`
      );
      return {
        provider,
        purged: false,
        detail: `Realtime Database responded ${response.status} ${response.statusText} — check the database rules allow deletes.`,
      };
    }
    return { provider, purged: true, detail: `Deleted flowzen-signals/${roomId}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[signaling] Could not purge room ${roomId}: ${message}`);
    return { provider, purged: false, detail: message };
  }
}
