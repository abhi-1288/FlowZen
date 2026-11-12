import { Schema, model, models, type InferSchemaType } from "mongoose";
import {
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
} from "@/lib/work-constants";

const CompactionDeliverySchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    compaction: {
      type: Schema.Types.ObjectId,
      ref: "TaskCompaction",
      default: null,
      index: true,
    },
    teamCompaction: {
      type: Schema.Types.ObjectId,
      ref: "TeamCompaction",
      default: null,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientName: { type: String, default: "" },
    recipientEmail: { type: String, default: "" },
    recipientRole: { type: String, default: "" },
    deliveryChannel: {
      type: String,
      enum: DELIVERY_CHANNELS,
      required: true,
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: "pending",
      index: true,
    },
    eventKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deliveredAt: { type: Date, default: null },
    errorDetails: { type: String, default: "", maxlength: 4000 },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    link: { type: String, default: "" },
  },
  { timestamps: true },
);

CompactionDeliverySchema.index({ compaction: 1, deliveryChannel: 1 });
CompactionDeliverySchema.index({ teamCompaction: 1, deliveryChannel: 1 });
CompactionDeliverySchema.index({ recipient: 1, createdAt: -1 });

export type CompactionDeliveryDocument = InferSchemaType<
  typeof CompactionDeliverySchema
>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).CompactionDelivery;
}
export const CompactionDelivery =
  (models as any).CompactionDelivery ||
  model("CompactionDelivery", CompactionDeliverySchema);
