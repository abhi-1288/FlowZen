export type SignalRole = "candidate" | "interviewer";

export type SignalPayload =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit }
  | { kind: "bye" };

export type SignalMessage = SignalPayload & {
  from: SignalRole;
  at: number;
};

export type PeerPresence = {
  present: boolean;
  name?: string;
};

export type SignalingClient = {
  /** Join the room and begin receiving the peer's messages. */
  connect(roomId: string, role: SignalRole, displayName: string): Promise<void>;
  /** Broadcast a payload to the other participant. No-op if not connected. */
  send(payload: SignalPayload): Promise<void>;
  /** Fires for every message sent by the *other* participant. */
  onMessage(handler: (message: SignalMessage) => void): () => void;
  /** Fires when the other participant joins, leaves, or updates their name. */
  onPeerPresence(handler: (presence: PeerPresence) => void): () => void;
  /** Leave the room and release the realtime subscription. */
  disconnect(): Promise<void>;
};

export type SignalingProviderName = "supabase" | "firebase";

/**
 * Top-level Realtime Database node holding every room's signalling traffic.
 * Shared with lib/signaling/purge.ts so the writer and the cleaner cannot drift
 * apart and silently target different keys.
 */
export const FIREBASE_SIGNAL_ROOT = "flowzen-signals";

/**
 * Lives here rather than in lib/signaling/index.ts because that module imports
 * both provider clients — including the Firebase one, which throws when
 * initialised outside a browser. Server-only code (API routes, the purge script)
 * needs the provider name without dragging in the browser SDKs.
 */
export function getSignalingProvider(): SignalingProviderName {
  const configured = process.env.NEXT_PUBLIC_SIGNALING_PROVIDER?.trim().toLowerCase();
  if (configured === "firebase" || configured === "supabase") return configured;
  return "supabase";
}

export class SignalingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignalingUnavailableError";
  }
}

/**
 * Supabase free tier allows 200 concurrent realtime connections and Firebase
 * RTDB Spark allows 100, which is why FlowZen video rooms are capped per
 * company per month. See lib/interview-quota.ts.
 */
export const SIGNALING_CONCURRENCY_LIMITS: Record<SignalingProviderName, number> = {
  supabase: 200,
  firebase: 100,
};
