import { Schema, model, models, type InferSchemaType } from "mongoose";

const WorkflowSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["requested", "assigned", "drafting", "salary-pending", "salary-approved", "draft-ready", "published", "rejected"],
      default: "requested",
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedHR: { type: Schema.Types.ObjectId, ref: "User", default: null },
    salaryApprovedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "" },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    requestedAt: { type: Date, default: null },
    assignedAt: { type: Date, default: null },
    forwardedAt: { type: Date, default: null },
    salaryApprovedAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ATSJobSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    department: { type: String, default: "", trim: true, maxlength: 100 },
    location: { type: String, default: "", trim: true, maxlength: 200 },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship"],
      default: "full-time",
    },
    salaryRangeMin: { type: Number, default: 0 },
    salaryRangeMax: { type: Number, default: 0 },
    salaryType: { type: String, enum: ["per-annum", "per-month"], default: "per-annum" },
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
    workflow: { type: WorkflowSchema, default: () => ({ status: "requested" }) },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  },
  { timestamps: true }
);

ATSJobSchema.index({ company: 1, status: 1 });
ATSJobSchema.index({ "workflow.status": 1, company: 1 });
ATSJobSchema.index({ "workflow.assignedHR": 1, "workflow.status": 1 });

export type ATSJobDocument = InferSchemaType<typeof ATSJobSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSJob;
}

export const ATSJob = (models as any).ATSJob || model("ATSJob", ATSJobSchema);
