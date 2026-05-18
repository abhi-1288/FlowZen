import { Schema, model, models, type InferSchemaType } from "mongoose";

const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task" },
    board: { type: Schema.Types.ObjectId, ref: "Board" },
    company: { type: Schema.Types.ObjectId, ref: "Company" },
    team: { type: Schema.Types.ObjectId, ref: "Team" },
    type: {
      type: String,
      enum: ["info", "approval", "project", "deadline", "system"],
      default: "info",
      index: true
    },
    title: { type: String, default: "Notification" },
    message: { type: String, default: "" },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export type NotificationDocument = InferSchemaType<typeof NotificationSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).Notification;
}

export const Notification = models.Notification || model("Notification", NotificationSchema);
