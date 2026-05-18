import { NextRequest } from "next/server";
import { eventHub } from "@/lib/event-hub";
import { requireUserId } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

      // Subscribe to the event hub
      eventHub.subscribe(userId, controller);

      // Keep connection alive with heartbeats every 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (err) {
          clearInterval(heartbeat);
          eventHub.unsubscribe(userId, controller);
        }
      }, 15000);

      // Handle close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        eventHub.unsubscribe(userId, controller);
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
