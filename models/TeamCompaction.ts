import { Schema, model, models, type InferSchemaType } from "mongoose";
import { TEAM_COMPACTION_STATUSES } from "@/lib/work-constants";

const EmployeeSummarySchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    employeeName: { type: String, default: "" },
    employeeCode: { type: String, default: "" },
    sourceCompactionId: {
      type: Schema.Types.ObjectId,
      ref: "TaskCompaction",
      default: null,
    },
    eodSummary: { type: String, default: "" },
    eowSummary: { type: String, default: "" },
    completedWork: { type: [String], default: [] },
    partialWork: { type: [String], default: [] },
    pendingWork: { type: [String], default: [] },
    blockers: { type: [String], default: [] },
    nextActions: { type: [String], default: [] },
    delegatedWork: { type: [String], default: [] },
    sourceLinks: { type: [String], default: [] },
  },
  { _id: false },
);

const PendingWorkSchema = new Schema(
  {
    title: { type: String, default: "" },
    employee: { type: String, default: "" },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    originalOwner: { type: String, default: "" },
    currentWorkingDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    dependencies: { type: String, default: "" },
    nextAction: { type: String, default: "" },
  },
  { _id: false },
);

const BlockerSchema = new Schema(
  {
    summary: { type: String, default: "" },
    employees: { type: [String], default: [] },
    waitingOn: { type: String, default: "" },
    escalationRequired: { type: Boolean, default: false },
    sourceCompactionId: {
      type: Schema.Types.ObjectId,
      ref: "TaskCompaction",
      default: null,
    },
  },
  { _id: false },
);

const HandoverSchema = new Schema(
  {
    summary: { type: String, default: "" },
    fromEmployee: { type: String, default: "" },
    toEmployee: { type: String, default: "" },
    status: { type: String, default: "" },
    sourceHandoverId: {
      type: Schema.Types.ObjectId,
      ref: "TaskHandover",
      default: null,
    },
  },
  { _id: false },
);

const TeamCompactionContentSchema = new Schema(
  {
    overview: {
      teamName: { type: String, default: "" },
      teamOwnerName: { type: String, default: "" },
      reportingPeriodStart: { type: Date, default: null },
      reportingPeriodEnd: { type: Date, default: null },
      participatingEmployees: { type: Number, default: 0 },
      receivedReports: { type: Number, default: 0 },
      missingReports: { type: [String], default: [] },
      exclusionReasons: { type: [String], default: [] },
    },
    overallSummary: { type: String, default: "", maxlength: 12000 },
    employeeSummaries: { type: [EmployeeSummarySchema], default: [] },
    pendingWork: { type: [PendingWorkSchema], default: [] },
    blockers: { type: [BlockerSchema], default: [] },
    handovers: { type: [HandoverSchema], default: [] },
    nextPeriodPlan: { type: String, default: "", maxlength: 8000 },
    metrics: {
      totalCompleted: { type: Number, default: 0 },
      totalPartial: { type: Number, default: 0 },
      totalPending: { type: Number, default: 0 },
      totalBlocked: { type: Number, default: 0 },
      pendingHandovers: { type: Number, default: 0 },
    },
    adminSupportRequired: { type: String, default: "", maxlength: 8000 },
  },
  { _id: false },
);

const AdminReviewSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["not_started", "under_review", "acknowledged", "correction_requested"],
      default: "not_started",
    },
    comments: {
      type: [
        new Schema(
          {
            user: { type: Schema.Types.ObjectId, ref: "User", required: true },
            body: { type: String, required: true, trim: true, maxlength: 4000 },
            action: {
              type: String,
              enum: ["comment", "acknowledged", "correction_requested", "follow_up"],
              default: "comment",
            },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    acknowledgedAt: { type: Date, default: null },
    followUpRequestedAt: { type: Date, default: null },
    correctionRequestedAt: { type: Date, default: null },
  },
  { _id: false },
);

const TeamCompactionSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    teamName: { type: String, default: "", trim: true, maxlength: 120 },
    teamOwner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teamOwnerName: { type: String, default: "", trim: true, maxlength: 120 },
    reportingPeriodStart: { type: Date, required: true, index: true },
    reportingPeriodEnd: { type: Date, required: true, index: true },
    reportingPeriodKey: { type: String, default: "", index: true },
    summary: { type: String, default: "", maxlength: 20000 },
    content: { type: TeamCompactionContentSchema, default: () => ({}) },
    status: {
      type: String,
      enum: TEAM_COMPACTION_STATUSES,
      default: "draft",
      index: true,
    },
    confirmedAt: { type: Date, default: null },
    submittedToAdminAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
    hasSourceCorrections: { type: Boolean, default: false },
    adminReview: { type: AdminReviewSchema, default: () => ({}) },
    revisionNumber: { type: Number, default: 1 },
    idempotencyKey: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

TeamCompactionSchema.index({ team: 1, reportingPeriodStart: -1 });
TeamCompactionSchema.index({ company: 1, status: 1, reportingPeriodStart: -1 });

export type TeamCompactionDocument = InferSchemaType<
  typeof TeamCompactionSchema
>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).TeamCompaction;
}
export const TeamCompaction =
  (models as any).TeamCompaction ||
  model("TeamCompaction", TeamCompactionSchema);
