import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSAuditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    entityType: { type: String, required: true, trim: true, maxlength: 50 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  },
  { timestamps: true }
);

ATSAuditLogSchema.index({ company: 1, createdAt: -1 });
ATSAuditLogSchema.index({ entityType: 1, entityId: 1 });

export type ATSAuditLogDocument = InferSchemaType<typeof ATSAuditLogSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSAuditLog;
}

export const ATSAuditLog = (models as any).ATSAuditLog || model("ATSAuditLog", ATSAuditLogSchema);
