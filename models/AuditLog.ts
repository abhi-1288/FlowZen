import { Schema, model, models, type InferSchemaType } from "mongoose";

const AuditLogSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    actorName: { type: String, default: "", trim: true, maxlength: 120 },
    actorEmail: { type: String, default: "", trim: true, maxlength: 200 },
    actorRole: { type: String, default: "", trim: true, maxlength: 50 },
    target: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    targetName: { type: String, default: "", trim: true, maxlength: 120 },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    actionLabel: { type: String, default: "", trim: true, maxlength: 160 },
    entityType: { type: String, default: "", trim: true, maxlength: 50 },
    entityId: { type: String, default: "", trim: true, maxlength: 100 },
    from: { type: Schema.Types.Mixed, default: null },
    to: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "", trim: true, maxlength: 64 },
    device: { type: String, default: "", trim: true, maxlength: 80 },
    result: { type: String, enum: ["success", "failed"], default: "success" },
  },
  { timestamps: true }
);

AuditLogSchema.index({ company: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ target: 1, createdAt: -1 });

export type AuditLogDocument = InferSchemaType<typeof AuditLogSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).AuditLog;
}

export const AuditLog = (models as any).AuditLog || model("AuditLog", AuditLogSchema);