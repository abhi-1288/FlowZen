import { Schema, model, models, type InferSchemaType } from "mongoose";

const MessageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    group: { type: Schema.Types.ObjectId, ref: "Team", default: null, index: true },
    message: { type: String, required: true },
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
