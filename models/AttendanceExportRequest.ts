import { Schema, model, models, type InferSchemaType } from "mongoose";

const AttendanceExportRequestSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    region: { type: String, required: true, trim: true, maxlength: 120 },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    approver: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    verificationStatus: { type: String, enum: ["none", "pending-verification", "verified"], default: "none", index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorizer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    pendingAction: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
    decisionReason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

AttendanceExportRequestSchema.index({ company: 1, requester: 1, region: 1, from: 1, to: 1, status: 1 });
export type AttendanceExportRequestDocument = InferSchemaType<typeof AttendanceExportRequestSchema>;
if (process.env.NODE_ENV === "development") delete (models as any).AttendanceExportRequest;
export const AttendanceExportRequest = models.AttendanceExportRequest || model("AttendanceExportRequest", AttendanceExportRequestSchema);
