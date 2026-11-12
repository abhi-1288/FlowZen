import { Schema, model, models, type InferSchemaType } from "mongoose";
import { BOARD_TODO_STATUSES } from "@/lib/work-constants";

const TodoProgressLogSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    todo: { type: Schema.Types.ObjectId, ref: "BoardTodo", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workingDate: { type: Date, required: true, index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    workNotes: { type: String, default: "", maxlength: 5000 },
    status: { type: String, enum: BOARD_TODO_STATUSES, default: "in_progress" },
    remainingWork: { type: String, default: "", maxlength: 5000 },
    blockerNotes: { type: String, default: "", maxlength: 5000 },
    minutesWorked: { type: Number, min: 0, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

TodoProgressLogSchema.index({ company: 1, workingDate: -1 });
TodoProgressLogSchema.index({ todo: 1, workingDate: -1 });
TodoProgressLogSchema.index({ employee: 1, workingDate: -1 });

export type TodoProgressLogDocument = InferSchemaType<
  typeof TodoProgressLogSchema
>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).TodoProgressLog;
}
export const TodoProgressLog =
  (models as any).TodoProgressLog ||
  model("TodoProgressLog", TodoProgressLogSchema);
