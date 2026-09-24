import { emitToUser } from "@/lib/socket-emit";
import { sendNotificationPush } from "@/lib/push";

export function emitNotification(userId: string) {
  emitToUser(userId, "notification:new", { userId, at: Date.now() });
  void sendNotificationPush(userId);
}