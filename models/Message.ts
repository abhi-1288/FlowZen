import { Schema, model, models, type InferSchemaType } from "mongoose";

const AttachmentSchema = new Schema(
  {
    provider: { type: String, required: true, enum: ["imagekit", "local"] },
    fileId: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    kind: { type: String, required: true, enum: ["image", "video", "file"] },
    expiresAt: { type: Date, required: true },
    isExpired: { type: Boolean, default: false },
  },
  { _id: false }
);

const MessageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    group: { type: Schema.Types.ObjectId, ref: "Team", default: null, index: true },
    message: { type: String, required: false, default: "" },
    attachment: { type: AttachmentSchema, default: null },
    receivedAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    groupReadBy: [{
      user: { type: Schema.Types.ObjectId, ref: "User" },
      readAt: { type: Date, default: Date.now },
    }],
    reactions: [{
      emoji: { type: String, required: true },
      user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    }],
    replyTo: { type: Schema.Types.ObjectId, ref: "Message", default: null },
  },
  { timestamps: true }
);

export type MessageDocument = InferSchemaType<typeof MessageSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).Message;
}

export const Message = models.Message || model("Message", MessageSchema);
