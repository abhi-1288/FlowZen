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
    quantity: { type: Number, default: 1, min: 1 },
    reason: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["pending", "forwarded", "approved", "rejected", "accepted", "disbursed"], default: "pending", index: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    adminApprover: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    forwardedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    disbursedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    disbursedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);

export type ExpenseRequestDocument = InferSchemaType<typeof ExpenseRequestSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.ExpenseRequest;
}

export const ExpenseRequest =
  models.ExpenseRequest || model("ExpenseRequest", ExpenseRequestSchema);
