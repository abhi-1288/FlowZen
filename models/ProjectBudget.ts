import { Schema, model, models, type InferSchemaType } from "mongoose";

const ProjectBudgetSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    region: { type: String, default: "", index: true },
    totalBudget: { type: Number, default: 0 },
    teamSpendingLimit: { type: Number, default: 0 },
    resourceBudget: { type: Number, default: 0 },
    deadline: { type: Date, default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    verificationStatus: { type: String, enum: ["none", "pending-verification", "verified"], default: "none" },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorizer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    pendingStatus: { type: String, default: "" },
    pendingReason: { type: String, default: "" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true },
);

ProjectBudgetSchema.index({ company: 1, board: 1 }, { unique: true });

export type ProjectBudgetDocument = InferSchemaType<typeof ProjectBudgetSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.ProjectBudget;
}

export const ProjectBudget =
  models.ProjectBudget || model("ProjectBudget", ProjectBudgetSchema);
