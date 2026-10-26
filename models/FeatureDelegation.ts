import { Schema, model, models, type InferSchemaType } from "mongoose";

const FeatureDelegationSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    authorizer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    featureKey: { type: String, required: true, trim: true, maxlength: 80 },
    featureName: { type: String, required: true, trim: true, maxlength: 120 },
    scope: [{ type: String, trim: true, maxlength: 80 }],
    pinHash: { type: String, required: true, select: false },
    pinCiphertext: { type: String, required: true, select: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "expired", "revoked", "suspended", "pending-approval"],
      default: "active",
      index: true,
    },
    // Delegated authority always needs the original authorizer's review.
    requiresVerification: { type: Boolean, default: true },
    reason: { type: String, default: "", trim: true, maxlength: 500 },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
    lastRevokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

FeatureDelegationSchema.index({ company: 1, authorizer: 1, recipient: 1, featureKey: 1, status: 1 });
FeatureDelegationSchema.index({ company: 1, recipient: 1, expiresAt: 1 });

export type FeatureDelegationDocument = InferSchemaType<typeof FeatureDelegationSchema>;
if (process.env.NODE_ENV === "development") delete (models as any).FeatureDelegation;
export const FeatureDelegation = models.FeatureDelegation || model("FeatureDelegation", FeatureDelegationSchema);
