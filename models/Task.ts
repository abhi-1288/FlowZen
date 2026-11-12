import { Schema, model, models, type InferSchemaType } from "mongoose";
import { BOARD_TASK_STATUSES } from "@/lib/work-constants";

const CommentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 }
  },
  { timestamps: true }
);

const ActivitySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    detail: { type: String, default: "" }
  },
  { timestamps: true }
);

const AttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true }
  },
  { _id: false }
);

const SubTaskSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false }
  },
  { _id: false }
);

const TaskDependencySchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    label: { type: String, default: "", trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["waiting", "resolved", "escalated"],
      default: "waiting",
    },
  },
  { _id: false },
);

const DeadlineChangeSchema = new Schema(
  {
    from: { type: Date, default: null },
    to: { type: Date, default: null },
    reason: { type: String, default: "", maxlength: 2000 },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const TaskSchema = new Schema(
  {
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    column: { type: Schema.Types.ObjectId, ref: "Column", required: true, index: true },
    // Continuity/organisation fields. Optional so the existing kanban routes
    // keep working with their current payloads.
    company: { type: Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    team: { type: Schema.Types.ObjectId, ref: "Team", default: null, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    project: { type: String, default: "", trim: true, maxlength: 160 },
    department: { type: String, default: "", trim: true, maxlength: 120 },
    instructions: { type: String, default: "", maxlength: 5000 },
    taskStatus: {
      type: String,
      enum: BOARD_TASK_STATUSES,
      default: "not_started",
      index: true,
    },
    startDate: { type: Date, default: null },
    originalDeadline: { type: Date, default: null },
    revisedDeadline: { type: Date, default: null },
    deadlineHistory: { type: [DeadlineChangeSchema], default: [] },
    dependencies: { type: [TaskDependencySchema], default: [] },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 3000 },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    order: { type: Number, required: true, default: 0 },
    pinned: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "approved",
      index: true
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    takenBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    takenByName: { type: String, default: "" },
    takenLead: { type: Schema.Types.ObjectId, ref: "User", default: null },
    takenLeadName: { type: String, default: "" },
    takenTeam: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    takenTeamName: { type: String, default: "" },
    attachments: { type: [AttachmentSchema], default: [] },
    subTasks: { type: [SubTaskSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    activity: { type: [ActivitySchema], default: [] }
  },
  { timestamps: true }
);

TaskSchema.index({ column: 1, order: 1 });
TaskSchema.index({ company: 1, owner: 1, createdAt: -1 });
TaskSchema.index({ team: 1, taskStatus: 1 });

export type TaskDocument = InferSchemaType<typeof TaskSchema>;
export const Task = models.Task || model("Task", TaskSchema);
