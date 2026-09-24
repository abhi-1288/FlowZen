import { Schema, model, models, type InferSchemaType } from "mongoose";

const PushSubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    userAgent: { type: String, default: "" }
  },
  { timestamps: true }
);

export type PushSubscriptionDocument = InferSchemaType<typeof PushSubscriptionSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).PushSubscription;
}

export const PushSubscription = models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);