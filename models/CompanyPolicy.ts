import mongoose from "mongoose";

const policySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  foodAmount: { type: Number, default: 0 },
  travelAccommodationAmount: { type: Number, default: 0 },
  foodOptedOutMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  travelOptedOutMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.CompanyPolicy;
}

export const CompanyPolicy = mongoose.models.CompanyPolicy ?? mongoose.model("CompanyPolicy", policySchema);
