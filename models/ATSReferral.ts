import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSReferralSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    candidate: { type: Schema.Types.ObjectId, ref: "ATSCandidate", required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", default: null, index: true },
    referralId: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "reviewed", "hired", "rejected"],
      default: "pending",
    },
    referralBonusEligible: { type: Boolean, default: false },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  },
  { timestamps: true }
);

ATSReferralSchema.index({ employee: 1, company: 1 });

export type ATSReferralDocument = InferSchemaType<typeof ATSReferralSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSReferral;
}

export const ATSReferral = (models as any).ATSReferral || model("ATSReferral", ATSReferralSchema);
