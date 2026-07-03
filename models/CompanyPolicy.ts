import mongoose from "mongoose";

const policySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  foodAmount: { type: Number, default: 0 },
  travelAccommodationAmount: { type: Number, default: 0 },
  foodOptedOutMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  travelOptedOutMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  pfPercentage: { type: Number, default: 12 },
  esicPercentage: { type: Number, default: 0.75 },
  salaryCycleDay: { type: Number, default: 29, min: 1, max: 31 },
  pendingSalaryCycleDay: { type: Number, default: null, min: 1, max: 31 },
  salaryCycleStartDay: { type: Number, default: null, min: 1, max: 31 },
  salaryCycleEndDay: { type: Number, default: null, min: 1, max: 31 },
  pendingSalaryCycleStartDay: { type: Number, default: null, min: 1, max: 31 },
  pendingSalaryCycleEndDay: { type: Number, default: null, min: 1, max: 31 },
  salaryCycleChangeStatus: { type: String, enum: ["pending", "approved", "rejected"], default: null },
  salaryCycleChangeRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  salaryCycleChangeApprover: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  salaryCycleChangeRequestedAt: { type: Date, default: null },
  advanceSalaryEnabled: { type: Boolean, default: false },
}, { timestamps: true });

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.CompanyPolicy;
}

export const CompanyPolicy = mongoose.models.CompanyPolicy ?? mongoose.model("CompanyPolicy", policySchema);
