import { Schema, model, models } from "mongoose";

const LeaveRequestSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    duration: { type: Number, required: true }, // in days
    reason: { type: String, required: true },
    attachmentUrl: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    status: { 
      type: String, 
      enum: ["pending", "manager-approved", "approved", "rejected"], 
      default: "pending" 
    },
    managerApprover: { type: Schema.Types.ObjectId, ref: "User" },
    adminApprover: { type: Schema.Types.ObjectId, ref: "User" },
    currentStep: { type: String, enum: ["manager", "admin"], default: "manager" }
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === "development") {
  delete (models as any).LeaveRequest;
}

export const LeaveRequest = models.LeaveRequest || model("LeaveRequest", LeaveRequestSchema);
