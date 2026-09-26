import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  SignalingUnavailableError,
  type PeerPresence,
  type SignalMessage,
  type SignalPayload,
  type SignalRole,
  type SignalingClient,
} from "@/lib/signaling/types";

const SIGNAL_EVENT = "signal";

const PEER_ROLE: Record<SignalRole, SignalRole> = {
  candidate: "interviewer",
  interviewer: "candidate",
};

export function createSupabaseSignalingClient(): SignalingClient {
  let channel: RealtimeChannel | null = null;
  let role: SignalRole = "candidate";
  let displayName = "";
  let ready = false;

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
        console.error("Supabase signaling handler failed:", error);
      }
    });
  }

  function emitPresence() {
    if (!channel) return;
    const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
    const entries = state[PEER_ROLE[role]] ?? [];
    const latest = entries.length > 0 ? entries[entries.length - 1] : null;
    const presence: PeerPresence = {
      present: entries.length > 0,
      name: typeof latest?.name === "string" ? latest.name : undefined,
    };
    presenceHandlers.forEach((handler) => {
      try {
        handler(presence);
      } catch (error) {
        console.error("Supabase presence handler failed:", error);
      }
    });
  }

  return {
    async connect(roomId, nextRole, name) {
      if (typeof window === "undefined") {
        throw new SignalingUnavailableError("Signaling can only start in the browser.");
      }

      const client = getSupabaseBrowserClient();
      role = nextRole;
      displayName = name;

      channel = client.channel(`flowzen:${roomId}`, {
        config: {
          presence: { key: role },
          broadcast: { self: false, ack: false },
        },
      });

      // `subscribe` returns the channel and reports state through its callback.
      // Resolve on SUBSCRIBED and reject on a hard failure so a dead socket
      // surfaces as an error instead of a room that silently never connects.
      const outcome = await new Promise<"ok" | "error">((resolve) => {
        let settled = false;
        const finish = (result: "ok" | "error") => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        channel!.on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => {
          emitMessage(payload as SignalPayload & { from?: SignalRole });
        });

        channel!.on("presence", { event: "sync" }, () => emitPresence());
        channel!.on("presence", { event: "join" }, () => emitPresence());
        channel!.on("presence", { event: "leave" }, () => emitPresence());

        channel!.subscribe(async (state) => {
          if (state === "SUBSCRIBED") {
            ready = true;
            await channel?.track({ name: displayName, role, onlineAt: Date.now() });
            finish("ok");
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            finish("error");
          }
        });
      });

      if (outcome === "error") {
        channel = null;
        ready = false;
        throw new SignalingUnavailableError(
          "Could not reach the FlowZen signalling service. Check your connection and try again."
        );
      }
    },

    async send(payload) {
      if (!channel || !ready) return;
      await channel.send({
        type: "broadcast",
        event: SIGNAL_EVENT,
        payload: { ...payload, from: role, at: Date.now() },
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
      if (!channel) return;
      const active = channel;
      channel = null;
      ready = false;
      try {
        await active.untrack();
      } catch {
        // best effort — the socket may already be closed
      }
      try {
        await getSupabaseBrowserClient().removeChannel(active);
      } catch {
        // best effort
      }
    },
  };
}
