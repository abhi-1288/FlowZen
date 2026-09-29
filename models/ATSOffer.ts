import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSOfferSchema = new Schema(
  {
    candidate: { type: Schema.Types.ObjectId, ref: "ATSCandidate", required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true, index: true },
    offeredCTC: { type: Number, required: true },
    salaryType: {
      type: String,
      enum: ["per-annum", "per-month", "per-day", "per-hour"],
      default: "per-annum",
    },
    currency: { type: String, default: "INR", trim: true, maxlength: 8 },
    pfAmount: { type: Number, default: 0 },
    esicAmount: { type: Number, default: 0 },
    joiningDate: { type: Date, default: null },
    designation: { type: String, required: true, trim: true, maxlength: 200 },
    department: { type: String, default: "", trim: true, maxlength: 100 },
    offerLetterUrl: { type: String, default: "" },
    officeLocation: { type: String, default: "", trim: true, maxlength: 500 },
    perks: { type: String, default: "", trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "rejected"],
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    signedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    signedAt: { type: Date, default: null },
    isSigned: { type: Boolean, default: false },
    // The OFFICE the hire joins, and the region whose head approves the
    // conversion. Resolved in `candidates/[id]/offer/route.ts` as
    // `candidate.joiningRegionLabel` -> `job.regionLabel` -> the generating
    // HR's own region.
    //
    // The candidate is now the primary source, which it deliberately was not
    // before: the bulk transfer in `jobs/[id]/bulk-region/route.ts` assigns the
    // region, and "send these to Pune, then Pune raises the offer" only holds
    // if the offer inherits the transfer rather than re-deciding it.
    //
    // `officeLocation` is still not a usable source — it is recruiter free text,
    // not an office label.
    regionLabel: { type: String, default: "", trim: true, maxlength: 200, index: true },
  },
  { timestamps: true }
);

ATSOfferSchema.index({ company: 1, regionLabel: 1, status: 1 });

export type ATSOfferDocument = InferSchemaType<typeof ATSOfferSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSOffer;
}

export const ATSOffer = (models as any).ATSOffer || model("ATSOffer", ATSOfferSchema);
