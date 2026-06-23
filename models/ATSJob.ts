import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSJobSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    location: { type: String, default: "", trim: true, maxlength: 200 },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship"],
      default: "full-time",
    },
    salaryRangeMin: { type: Number, default: 0 },
    salaryRangeMax: { type: Number, default: 0 },
    currency: { type: String, default: "INR", trim: true },
    openings: { type: Number, default: 1, min: 1 },
    autoCloseDate: { type: Date, default: null },
    description: { type: String, default: "", maxlength: 5000 },
    requiredSkills: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["draft", "open", "closed"],
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  },
  { timestamps: true }
);

ATSJobSchema.index({ company: 1, status: 1 });

export type ATSJobDocument = InferSchemaType<typeof ATSJobSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSJob;
}

export const ATSJob = (models as any).ATSJob || model("ATSJob", ATSJobSchema);
