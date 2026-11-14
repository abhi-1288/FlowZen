import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Finance-initiated removal of a member's attendance record, gated by a
 * two-person rule: the member's team owner (when the member belongs to a team)
 * and an admin of the member's region must both approve before the record is
 * deleted. When the member has no team, the regional admin alone completes it.
 * Mirrors `AttendanceExportRequest` in shape and lifecycle.
 */
const AttendanceDeleteRequestSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attendance: { type: Schema.Types.ObjectId, ref: "Attendance", required: true },
    // Denormalized calendar day of the record, for display without a join.
    date: { type: Date, required: true },
    // The member's region; the admin approver is resolved from it.
    region: { type: String, default: "", trim: true, maxlength: 120 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    teamOwnerRequired: { type: Boolean, default: false },
    // First gate of the flow: the request lands with the Finance user of the
    // member's region before the team owner and admin get their turn. When
    // Finance itself raised the request the slot is auto-approved at creation.
    financeApproval: {
      approver: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      decidedAt: { type: Date, default: null },
      reason: { type: String, default: "", trim: true, maxlength: 500 },
    },
    teamOwnerApproval: {
      approver: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      decidedAt: { type: Date, default: null },
      reason: { type: String, default: "", trim: true, maxlength: 500 },
    },
    adminApproval: {
      approver: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      decidedAt: { type: Date, default: null },
      reason: { type: String, default: "", trim: true, maxlength: 500 },
    },
    // pending = waiting on the required approvals; approved = both granted and
    // the attendance record removed; rejected = any required approver refused.
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  },
  { timestamps: true },
);

AttendanceDeleteRequestSchema.index({ company: 1, attendance: 1, status: 1 });
export type AttendanceDeleteRequestDocument = InferSchemaType<typeof AttendanceDeleteRequestSchema>;
if (process.env.NODE_ENV === "development") delete (models as any).AttendanceDeleteRequest;
export const AttendanceDeleteRequest = models.AttendanceDeleteRequest || model("AttendanceDeleteRequest", AttendanceDeleteRequestSchema);
