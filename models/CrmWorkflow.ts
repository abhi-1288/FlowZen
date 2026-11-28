import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmWorkflowConditionSchema = new Schema(
  { field: { type: String, default: "" }, operator: { type: String, default: "equals" }, value: { type: String, default: "" } },
  { _id: false },
);

const CrmWorkflowActionSchema = new Schema(
  { type: { type: String, default: "" }, config: { type: String, default: "" } },
  { _id: false },
);

const CrmWorkflowLogSchema = new Schema(
  { id: { type: String }, time: { type: String, default: "" }, record: { type: String, default: "" }, status: { type: String, default: "" }, duration: { type: String, default: "" }, error: { type: String, default: "" } },
  { _id: false },
);

const CrmWorkflowSchema = new Schema(
  {
    name: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    trigger: { type: String, default: "" },
    conditions: { type: [CrmWorkflowConditionSchema], default: [] },
    actions: { type: [CrmWorkflowActionSchema], default: [] },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "Draft" },
    lastRun: { type: String, default: "Never" },
    executions: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
    logs: { type: [CrmWorkflowLogSchema], default: [] },
  },
  { timestamps: true, strict: false },
);

export type CrmWorkflowDocument = InferSchemaType<typeof CrmWorkflowSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmWorkflow;
}

export const CrmWorkflow = models.CrmWorkflow || model("CrmWorkflow", CrmWorkflowSchema);
