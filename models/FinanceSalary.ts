import { Schema, model, models, type InferSchemaType } from "mongoose";

const FinanceSalarySchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: String, required: true, index: true },
    baseSalary: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "approved", "paid"], default: "pending", index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

FinanceSalarySchema.index({ company: 1, employee: 1, month: 1 }, { unique: true });

export type FinanceSalaryDocument = InferSchemaType<typeof FinanceSalarySchema>;

if (process.env.NODE_ENV === "development") {
  delete models.FinanceSalary;
}

export const FinanceSalary =
  models.FinanceSalary || model("FinanceSalary", FinanceSalarySchema);
