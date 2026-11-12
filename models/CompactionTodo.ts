import { Schema, model, models, type InferSchemaType } from "mongoose";
import {
  BOARD_TODO_STATUSES,
  COMPACTION_CATEGORIES,
  PRIORITIES,
} from "@/lib/work-constants";

const CompactionTodoSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    compaction: {
      type: Schema.Types.ObjectId,
      ref: "TaskCompaction",
      required: true,
      index: true,
    },
    todo: { type: Schema.Types.ObjectId, ref: "BoardTodo", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", default: null, index: true },
    category: { type: String, enum: COMPACTION_CATEGORIES, required: true, index: true },
    title: { type: String, default: "", trim: true, maxlength: 200 },
    project: { type: String, default: "", trim: true, maxlength: 160 },
    statusAtSubmission: {
      type: String,
      enum: BOARD_TODO_STATUSES,
      default: "in_progress",
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    completedWork: { type: String, default: "", maxlength: 5000 },
    remainingWork: { type: String, default: "", maxlength: 5000 },
    pendingWork: { type: String, default: "", maxlength: 5000 },
    blockerNotes: { type: String, default: "", maxlength: 5000 },
    waitingOn: { type: String, default: "", maxlength: 300 },
    assistanceRequired: { type: String, default: "", maxlength: 2000 },
    nextAction: { type: String, default: "", maxlength: 2000 },
    expectedContinuationDate: { type: Date, default: null },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    dueDate: { type: Date, default: null },
    originalAssignedDate: { type: Date, default: null },
    currentWorkingDate: { type: Date, default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    originalOwnerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    delegatedFromId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDelegated: { type: Boolean, default: false },
    minutesWorked: { type: Number, min: 0, default: null },
  },
  { timestamps: true },
);

CompactionTodoSchema.index(
  { compaction: 1, todo: 1 },
  { unique: true, name: "compaction_todo_unique" },
);
CompactionTodoSchema.index({ company: 1, task: 1 });

export type CompactionTodoDocument = InferSchemaType<typeof CompactionTodoSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).CompactionTodo;
}
export const CompactionTodo =
  (models as any).CompactionTodo ||
  model("CompactionTodo", CompactionTodoSchema);
