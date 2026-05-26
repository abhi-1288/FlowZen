import { Schema, model, models, type InferSchemaType } from "mongoose";

const ExpenseBillSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    budget: { type: Schema.Types.ObjectId, ref: "ProjectBudget", required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ExpenseBillDocument = InferSchemaType<typeof ExpenseBillSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.ExpenseBill;
}

export const ExpenseBill =
  models.ExpenseBill || model("ExpenseBill", ExpenseBillSchema);
