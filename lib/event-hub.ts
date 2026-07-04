import { NextRequest } from "next/server";

/**
 * Event Hub for Server-Sent Events (SSE)
 * Maintains a map of user IDs to their active stream controllers.
 */
class EventHub {
  private static instance: EventHub;
  private clients: Map<string, ReadableStreamDefaultController[]> = new Map();

  private constructor() {}

  public static getInstance(): EventHub {
    if (!EventHub.instance) {
      EventHub.instance = new EventHub();
    }
    return EventHub.instance;
  }

  public subscribe(userId: string, controller: ReadableStreamDefaultController) {
    console.log(`EventHub: User ${userId} subscribed.`);
    const userClients = this.clients.get(userId) || [];
    userClients.push(controller);
    this.clients.set(userId, userClients);
  }

  public unsubscribe(userId: string, controller: ReadableStreamDefaultController) {
    const userClients = this.clients.get(userId) || [];
    const index = userClients.indexOf(controller);
    if (index !== -1) {
      userClients.splice(index, 1);
    }
    if (userClients.length === 0) {
      this.clients.delete(userId);
    } else {
      this.clients.set(userId, userClients);
    }
  }

  public hasSubscriber(userId: string): boolean {
    const userClients = this.clients.get(userId);
    return !!userClients && userClients.length > 0;
  }

  public emit(userId: string, event: string, data: any) {
    const userClients = this.clients.get(userId);
    console.log(`EventHub: Emitting ${event} to user ${userId}. Clients found: ${userClients?.length ?? 0}`);
    if (!userClients) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();

    userClients.forEach((controller) => {
      try {
        controller.enqueue(encoder.encode(payload));
      } catch (err) {
        // Client might have disconnected
        this.unsubscribe(userId, controller);
      }
    });
  }
}

const globalHub = globalThis as unknown as { eventHub: EventHub };

if (!globalHub.eventHub) {
  globalHub.eventHub = EventHub.getInstance();
}

export const eventHub = globalHub.eventHub;
