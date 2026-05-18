import { emitToUser } from "@/lib/socket-emit";

export function emitNotification(userId: string) {
  emitToUser(userId, "notification:new", { userId, at: Date.now() });
}
