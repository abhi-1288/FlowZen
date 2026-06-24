import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSOfferSchema = new Schema(
  {
    candidate: { type: Schema.Types.ObjectId, ref: "ATSCandidate", required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true, index: true },
    offeredCTC: { type: Number, required: true },
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
  },
  { timestamps: true }
);

export type ATSOfferDocument = InferSchemaType<typeof ATSOfferSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSOffer;
}

export const ATSOffer = (models as any).ATSOffer || model("ATSOffer", ATSOfferSchema);
