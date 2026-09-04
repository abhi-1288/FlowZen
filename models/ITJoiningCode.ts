import { Schema, model, models, type InferSchemaType } from "mongoose";

const ITJoiningCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    intendedRole: { type: String, enum: ["it-administration"], default: "it-administration" },
    organization: { type: String, default: "IT Team" },
    expiresAt: { type: Date, required: true, index: true },
    maxUses: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0 },
    usedBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        usedAt: { type: Date, default: Date.now },
      },
    ],
    status: { type: String, enum: ["active", "expired", "revoked"], default: "active", index: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ITJoiningCodeSchema.index({ company: 1, status: 1, createdAt: -1 });

export type ITJoiningCodeDocument = InferSchemaType<typeof ITJoiningCodeSchema>;
if (process.env.NODE_ENV === "development") {
  delete models.ITJoiningCode;
}

export const ITJoiningCode = models.ITJoiningCode || model("ITJoiningCode", ITJoiningCodeSchema);
