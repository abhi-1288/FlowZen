import { Schema, model, models, type InferSchemaType } from "mongoose";
import {
  COMPACTION_TYPES,
  EMPLOYEE_COMPACTION_STATUSES,
} from "@/lib/work-constants";

const AttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const ReviewCommentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    action: {
      type: String,
      enum: ["comment", "reviewed", "correction_requested"],
      default: "comment",
    },
  },
  { timestamps: true },
);

const CompactionContentSchema = new Schema(
  {
    completedWork: { type: [String], default: [] },
    partialWork: { type: [String], default: [] },
    pendingWork: { type: [String], default: [] },
    blockers: { type: [String], default: [] },
    decisions: { type: String, default: "", maxlength: 8000 },
    handoverNotes: { type: String, default: "", maxlength: 8000 },
    risks: { type: String, default: "", maxlength: 8000 },
    nextActions: { type: String, default: "", maxlength: 8000 },
    additionalNotes: { type: String, default: "", maxlength: 8000 },
    attachmentIds: { type: [String], default: [] },
  },
  { _id: false },
);

const TaskCompactionSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    employeeName: { type: String, default: "", trim: true, maxlength: 120 },
    employeeCode: { type: String, default: "", trim: true, maxlength: 60 },
    team: { type: Schema.Types.ObjectId, ref: "Team", default: null, index: true },
    teamName: { type: String, default: "", trim: true, maxlength: 120 },
    teamOwner: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    teamOwnerName: { type: String, default: "", trim: true, maxlength: 120 },
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null, index: true },
    boardName: { type: String, default: "", trim: true, maxlength: 160 },
    department: { type: String, default: "", trim: true, maxlength: 120 },
    project: { type: String, default: "", trim: true, maxlength: 160 },
    reportingDate: { type: Date, required: true, index: true },
    reportingDateKey: { type: String, required: true, index: true },
    compactionType: { type: String, enum: COMPACTION_TYPES, required: true, index: true },
    workSessionStart: { type: Date, default: null },
    workSessionEnd: { type: Date, default: null },
    reasonForContinuing: { type: String, default: "", maxlength: 4000 },
    summary: { type: String, default: "", maxlength: 12000 },
    content: { type: CompactionContentSchema, default: () => ({}) },
    status: {
      type: String,
      enum: EMPLOYEE_COMPACTION_STATUSES,
      default: "awaiting_confirmation",
      index: true,
    },
    reviewStatus: {
      type: String,
      enum: ["pending", "reviewed", "correction_requested"],
      default: "pending",
      index: true,
    },
    reviewComments: { type: [ReviewCommentSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },
    source: {
      type: String,
      enum: ["attendance_checkout", "manual", "recovery", "api"],
      default: "manual",
    },
    attendance: {
      type: Schema.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },
    checkoutAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    deliveredToTeamOwnerAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
    lastReminderAt: { type: Date, default: null },
    revisionNumber: { type: Number, default: 1 },
    idempotencyKey: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },
    // true after a correction, so a team report including this source can warn
    // the Team Owner that the consolidated text needs re-review.
    hasOpenCorrection: { type: Boolean, default: false },
    includedInTeamCompaction: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

TaskCompactionSchema.index({ employee: 1, reportingDate: -1 });
TaskCompactionSchema.index({ team: 1, reportingDate: -1 });
TaskCompactionSchema.index({ company: 1, status: 1, reportingDate: -1 });
TaskCompactionSchema.index(
  { employee: 1, compactionType: 1, reportingDateKey: 1, idempotencyKey: 1 },
  { name: "compaction_identity" },
);

export type TaskCompactionDocument = InferSchemaType<
  typeof TaskCompactionSchema
>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).TaskCompaction;
}
export const TaskCompaction =
  (models as any).TaskCompaction ||
  model("TaskCompaction", TaskCompactionSchema);
