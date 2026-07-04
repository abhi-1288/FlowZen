import { NextRequest } from "next/server";
import { eventHub } from "@/lib/event-hub";
import { requireUserId } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { emitToUser } from "@/lib/socket-emit";

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

      // Fire-and-forget: mark pending messages as received + notify company
      onUserOnline(userId);

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
        onUserOffline(userId);
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

async function onUserOnline(userId: string) {
  try {
    await connectDb();
    // Mark pending messages as received
    const pendingMessages = await Message.find(
      { recipient: userId, receivedAt: null },
      { sender: 1 }
    );
    if (pendingMessages.length > 0) {
      const senderIds = [...new Set(pendingMessages.map(m => String(m.sender)))];
      await Message.updateMany(
        { recipient: userId, receivedAt: null },
        { $set: { receivedAt: new Date() } }
      );
      senderIds.forEach(senderId => {
        emitToUser(senderId, "message:received", { userId });
      });
    }

    // Notify company members that this user is online
    const user = await User.findById(userId).select("company lastOnline");
    if (user?.company) {
      const members = await User.find({
        company: user.company,
        companyStatus: "approved",
        _id: { $ne: user._id },
      }).select("_id");
      members.forEach(m => {
        emitToUser(String(m._id), "user:online", { userId });
      });
    }

    // Update user's lastOnline timestamp
    await User.findByIdAndUpdate(userId, { lastOnline: new Date() });
  } catch (err) {
    console.error("onUserOnline error:", err);
  }
}

async function onUserOffline(userId: string) {
  try {
    // Only notify if no more active connections for this user
    if (eventHub.hasSubscriber(userId)) return;

    await connectDb();
    const user = await User.findById(userId).select("company lastOnline");
    if (user?.company) {
      await User.findByIdAndUpdate(userId, { lastOnline: new Date() });
      const members = await User.find({
        company: user.company,
        companyStatus: "approved",
        _id: { $ne: user._id },
      }).select("_id");
      members.forEach(m => {
        emitToUser(String(m._id), "user:offline", { userId });
      });
    }
  } catch (err) {
    console.error("onUserOffline error:", err);
  }
}
