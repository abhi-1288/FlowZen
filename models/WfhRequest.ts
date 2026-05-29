import { Schema, model, models } from "mongoose";

const WfhRequestSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    duration: { type: Number, required: true }, // in days
    reason: { type: String, required: true },
    rejectionReason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "manager-approved", "hr-approved", "approved", "rejected"],
      default: "pending",
    },
    managerApprover: { type: Schema.Types.ObjectId, ref: "User" },
    hrApprover: { type: Schema.Types.ObjectId, ref: "User" },
    adminApprover: { type: Schema.Types.ObjectId, ref: "User" },
    currentStep: { type: String, enum: ["manager", "hr", "admin"], default: "manager" },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === "development") {
  delete (models as any).WfhRequest;
}

export const WfhRequest = models.WfhRequest || model("WfhRequest", WfhRequestSchema);
