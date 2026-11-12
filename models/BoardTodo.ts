import { Schema, model, models, type InferSchemaType } from "mongoose";
import {
  BOARD_TODO_STATUSES,
  PRIORITIES,
} from "@/lib/work-constants";

const AttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const DependencySchema = new Schema(
  {
    todoId: { type: Schema.Types.ObjectId, ref: "BoardTodo", default: null },
    label: { type: String, default: "", trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["waiting", "resolved", "escalated"],
      default: "waiting",
    },
    notes: { type: String, default: "", maxlength: 1000 },
  },
  { _id: false },
);

const BlockerSchema = new Schema(
  {
    reason: { type: String, default: "", trim: true, maxlength: 1000 },
    waitingOn: { type: String, default: "", trim: true, maxlength: 200 },
    escalated: { type: Boolean, default: false },
    raisedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const CommentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

const CarryForwardSchema = new Schema(
  {
    fromDate: { type: Date, default: null },
    toDate: { type: Date, required: true },
    reason: { type: String, default: "", trim: true, maxlength: 1000 },
    action: {
      type: String,
      enum: [
        "continue_tomorrow",
        "schedule",
        "blocked",
        "delegate",
        "request_assistance",
        "cancel",
      ],
      default: "schedule",
    },
    continuationTodoId: {
      type: Schema.Types.ObjectId,
      ref: "BoardTodo",
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const DelegationHistorySchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", default: null },
    to: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["requested", "accepted", "declined", "cancelled", "reassigned"],
      default: "requested",
    },
    reason: { type: String, default: "", maxlength: 1000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const BoardTodoSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    // Shadow record for a legacy Kanban task once an employee takes it into
    // active work. The original Task remains the source of truth.
    sourceType: {
      type: String,
      enum: ["continuity_todo", "board_task"],
      default: "continuity_todo",
      index: true,
    },
    parentTodoId: {
      type: Schema.Types.ObjectId,
      ref: "BoardTodo",
      default: null,
      index: true,
    },
    // The original todo in a carry-forward chain. Every continuation keeps this
    // pointer so the complete journey can be replayed without walking parents.
    lineageRootId: {
      type: Schema.Types.ObjectId,
      ref: "BoardTodo",
      default: null,
      index: true,
    },
    continuationOf: {
      type: Schema.Types.ObjectId,
      ref: "BoardTodo",
      default: null,
    },
    carryForwardKey: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 5000 },
    instructions: { type: String, default: "", maxlength: 5000 },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Never overwritten by delegation or by a continuation.
    originalOwnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    originalAssignedDate: { type: Date, required: true, index: true },
    currentWorkingDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, default: null, index: true },
    priority: { type: String, enum: PRIORITIES, default: "medium", index: true },
    status: {
      type: String,
      enum: BOARD_TODO_STATUSES,
      default: "not_started",
      index: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    dependencies: { type: [DependencySchema], default: [] },
    blockers: { type: [BlockerSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },
    completionNotes: { type: String, default: "", maxlength: 5000 },
    partialWorkNotes: { type: String, default: "", maxlength: 5000 },
    remainingWork: { type: String, default: "", maxlength: 5000 },
    nextAction: { type: String, default: "", maxlength: 2000 },
    expectedContinuationDate: { type: Date, default: null },
    carryForwardHistory: { type: [CarryForwardSchema], default: [] },
    delegationHistory: { type: [DelegationHistorySchema], default: [] },
    isContinuation: { type: Boolean, default: false },
    lastProgressAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

BoardTodoSchema.index({ company: 1, assigneeId: 1, status: 1 });
BoardTodoSchema.index({ task: 1, createdAt: 1 });
BoardTodoSchema.index({ lineageRootId: 1, createdAt: 1 });
BoardTodoSchema.index({ assigneeId: 1, currentWorkingDate: -1 });

export type BoardTodoDocument = InferSchemaType<typeof BoardTodoSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).BoardTodo;
}
export const BoardTodo =
  (models as any).BoardTodo || model("BoardTodo", BoardTodoSchema);
