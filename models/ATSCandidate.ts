import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSCandidateSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, default: "", trim: true, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true, maxlength: 20 },
    currentCompany: { type: String, default: "", trim: true, maxlength: 120 },
    experienceYears: { type: Number, default: 0, min: 0 },
    currentCTC: { type: Number, default: 0 },
    expectedCTC: { type: Number, default: 0 },
    noticePeriod: { type: Number, default: 0, min: 0 },
    source: {
      type: String,
      enum: ["Referral", "LinkedIn", "Company Website", "Naukri", "Indeed", "Walk-In", "Other"],
      default: "Other",
    },
    stage: {
      type: String,
      enum: ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"],
      default: "applied",
      index: true,
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    notes: { type: String, default: "", maxlength: 3000 },
    resumeUrl: { type: String, default: "" },
    portfolioUrl: { type: String, default: "" },
    linkedInUrl: { type: String, default: "" },
    assignedRecruiter: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  },
  { timestamps: true }
);

ATSCandidateSchema.index({ company: 1, stage: 1 });
ATSCandidateSchema.index({ company: 1, job: 1 });

export type ATSCandidateDocument = InferSchemaType<typeof ATSCandidateSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSCandidate;
}

export const ATSCandidate = (models as any).ATSCandidate || model("ATSCandidate", ATSCandidateSchema);
