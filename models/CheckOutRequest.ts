import { Schema, model, models, type InferSchemaType } from "mongoose";

const CheckOutRequestSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attendance: { type: Schema.Types.ObjectId, ref: "Attendance", required: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    date: { type: Date, required: true },
    requestedCheckOut: { type: Date, required: true },
    reason: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    verificationStatus: { type: String, enum: ["none", "pending-verification", "verified"], default: "none" },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorizer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    pendingAction: { type: String, default: "" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

export type CheckOutRequestDocument = InferSchemaType<typeof CheckOutRequestSchema>;
if (process.env.NODE_ENV === "development") {
  delete models.CheckOutRequest;
}

export const CheckOutRequest = models.CheckOutRequest || model("CheckOutRequest", CheckOutRequestSchema);
