import { eventHub } from "./event-hub";

/**
 * Utility to emit events via Server-Sent Events (SSE).
 */
export function emitToUser(userId: string, event: string, payload: any) {
  eventHub.emit(userId, event, payload);
}

export function isUserOnline(userId: string): boolean {
  return eventHub.hasSubscriber(userId);
}

export function emitToBoard(board: any, event: string, payload: any) {
  if (!board?.members) return;

  board.members.forEach((member: any) => {
    const memberId = typeof member.user === "string" ? member.user : member.user?._id || member.user?.id;
    if (memberId) {
      eventHub.emit(String(memberId), event, payload);
    }
  });
}
