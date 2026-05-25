import { Schema, model, models, type InferSchemaType } from "mongoose";

const ExpenseRequestSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["software", "device", "travel", "office-resources"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    amount: { type: Number, default: 0 },
    reason: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export type ExpenseRequestDocument = InferSchemaType<typeof ExpenseRequestSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.ExpenseRequest;
}

export const ExpenseRequest =
  models.ExpenseRequest || model("ExpenseRequest", ExpenseRequestSchema);
