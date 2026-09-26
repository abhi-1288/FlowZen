import { createFirebaseSignalingClient } from "@/lib/signaling/firebase";
import { createSupabaseSignalingClient } from "@/lib/signaling/supabase";
import {
  SIGNALING_CONCURRENCY_LIMITS,
  getSignalingProvider,
  type SignalingClient,
  type SignalingProviderName,
} from "@/lib/signaling/types";

/**
 * Creates a signalling client for the configured provider. Both implementations
 * expose the same interface, so switching between Supabase and Firebase is an
 * environment variable rather than a code change.
 */
export function createSignalingClient(): SignalingClient {
  return getSignalingProvider() === "firebase"
    ? createFirebaseSignalingClient()
    : createSupabaseSignalingClient();
}

export { SIGNALING_CONCURRENCY_LIMITS, getSignalingProvider };
export type { SignalingClient, SignalingProviderName };
export { SignalingUnavailableError } from "@/lib/signaling/types";
