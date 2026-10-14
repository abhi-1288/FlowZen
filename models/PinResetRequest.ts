import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A member's request for their regional HR to reset their Green PIN.
 *
 * Stores no PIN material; storing `expiresAt` with a TTL index also keeps the
 * collection from growing forever. Fulfillment sets a new PIN and bumps the
 * user's `pinVersion`, which relocks sessions holding the old version.
 */
const PinResetRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    region: { type: String, default: "", trim: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, default: "", trim: true, maxlength: 240 },
    status: { type: String, enum: ["pending", "fulfilled", "cancelled"], default: "pending", index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolutionMethod: { type: String, enum: ["manual", "generated"], default: null },
    fulfilledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true },
);

PinResetRequestSchema.index({ company: 1, status: 1, createdAt: -1 });
PinResetRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PinResetRequestDocument = InferSchemaType<typeof PinResetRequestSchema>;

if (process.env.NODE_ENV === "development") {
  delete (models as any).PinResetRequest;
}

export const PinResetRequest =
  (models as any).PinResetRequest || model("PinResetRequest", PinResetRequestSchema);
