import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSAssessmentQuestionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    options: [{ type: String, trim: true, maxlength: 500 }],
    correctIndex: { type: Number, default: 0, min: 0 },
    type: { type: String, enum: ["mcq", "essay"], default: "mcq" },
    answer: { type: String, default: "", trim: true, maxlength: 2000 },
    marks: { type: Number, default: 1, min: 0, max: 100 },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const ATSAssessmentDomainSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    limit: { type: Number, default: 0, min: 0, max: 500 },
    questions: { type: [ATSAssessmentQuestionSchema], default: [] },
  },
  { _id: false }
);

const ATSAssessmentSchema = new Schema(
  {
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true, unique: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    passScore: { type: Number, default: 50, min: 0, max: 100 },
    negativeMarking: { type: Number, default: 0, min: 0, max: 100 },
    questions: { type: [ATSAssessmentQuestionSchema], default: [] },
    domains: { type: [ATSAssessmentDomainSchema], default: [] },
    answerKeyPublished: { type: Boolean, default: false },
    answerKeyPublishedAt: { type: Date, default: null },
    resultsAppliedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export type ATSAssessmentDocument = InferSchemaType<typeof ATSAssessmentSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSAssessment;
}

export const ATSAssessment = (models as any).ATSAssessment || model("ATSAssessment", ATSAssessmentSchema);