import { Schema, model, models, type InferSchemaType } from "mongoose";

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

const TaskSchema = new Schema(
  {
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    column: { type: Schema.Types.ObjectId, ref: "Column", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 3000 },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    order: { type: Number, required: true, default: 0 },
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

export type TaskDocument = InferSchemaType<typeof TaskSchema>;
export const Task = models.Task || model("Task", TaskSchema);
