import mongoose from "mongoose";

const policySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  foodAmount: { type: Number, default: 0 },
  travelAccommodationAmount: { type: Number, default: 0 },
  foodOptedOutMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  travelOptedOutMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  pfPercentage: { type: Number, default: 12 },
  esicPercentage: { type: Number, default: 0.75 },
  tdsPercentage: { type: Number, default: 0 },
  houseRentPercentage: { type: Number, default: 37.33 },
  conveyancePercentage: { type: Number, default: 5.92 },
  medicalPercentage: { type: Number, default: 4.63 },
  specialAllowancePercentage: { type: Number, default: 74.33 },
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
  // Exit & final settlement policy.
  settlementEnabled: { type: Boolean, default: true },
  settlementHourDays: { type: Number, default: 1, min: 0, max: 30 },
  settlementDayDays: { type: Number, default: 2, min: 0, max: 30 },
  settlementMonthDays: { type: Number, default: 10, min: 0, max: 90 },
  // Per-employment-type notice rule (read-only reference for record/display).
  // part-time = no notice; internship/contract/permanent = serves notice.
  settlementNoticeRule: {
    type: Map,
    of: Boolean,
    default: {
      "part-time": false,
      internship: true,
      contract: true,
      permanent: true,
      "full-time": true,
    },
  },
}, { timestamps: true });

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.CompanyPolicy;
}

export const CompanyPolicy = mongoose.models.CompanyPolicy ?? mongoose.model("CompanyPolicy", policySchema);
