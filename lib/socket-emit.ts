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

  const memberIds: string[] = [];
  board.members.forEach((member: any) => {
    const memberId = typeof member.user === "string" ? member.user : member.user?._id || member.user?.id;
    if (memberId) memberIds.push(String(memberId));
  });

  // One fan-out write for the whole board instead of one per member.
  eventHub.emitMany(memberIds, event, payload);
}
