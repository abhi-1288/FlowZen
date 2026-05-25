import { Schema, model, models, type InferSchemaType } from "mongoose";

const ProjectBudgetSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    totalBudget: { type: Number, default: 0 },
    teamSpendingLimit: { type: Number, default: 0 },
    resourceBudget: { type: Number, default: 0 },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
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
