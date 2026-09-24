import { emitToUser } from "@/lib/socket-emit";
import { sendNotificationPush, type PushNotificationInput } from "@/lib/push";

export function emitNotification(userId: string, notification?: PushNotificationInput | null) {
  emitToUser(userId, "notification:new", { userId, at: Date.now() });
  void sendNotificationPush(userId, notification);
}