import { Schema, model, models, type InferSchemaType } from "mongoose";
import { HANDOVER_STATUSES } from "@/lib/work-constants";

const AttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const TaskHandoverSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    todo: { type: Schema.Types.ObjectId, ref: "BoardTodo", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", default: null, index: true },
    fromEmployee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toEmployee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    instructions: { type: String, default: "", maxlength: 5000 },
    attachments: { type: [AttachmentSchema], default: [] },
    status: {
      type: String,
      enum: HANDOVER_STATUSES,
      default: "pending",
      index: true,
    },
    previousAssignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    declineReason: { type: String, default: "", maxlength: 2000 },
    cancelledAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

TaskHandoverSchema.index({ todo: 1, status: 1 });
TaskHandoverSchema.index({ toEmployee: 1, status: 1, createdAt: -1 });
TaskHandoverSchema.index({ fromEmployee: 1, status: 1, createdAt: -1 });

export type TaskHandoverDocument = InferSchemaType<typeof TaskHandoverSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).TaskHandover;
}
export const TaskHandover =
  (models as any).TaskHandover || model("TaskHandover", TaskHandoverSchema);
