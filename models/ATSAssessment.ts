import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSAssessmentQuestionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    options: [{ type: String, trim: true, maxlength: 500 }],
    correctIndex: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ATSAssessmentSchema = new Schema(
  {
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true, unique: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    passScore: { type: Number, default: 50, min: 0, max: 100 },
    questions: { type: [ATSAssessmentQuestionSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export type ATSAssessmentDocument = InferSchemaType<typeof ATSAssessmentSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSAssessment;
}

export const ATSAssessment = (models as any).ATSAssessment || model("ATSAssessment", ATSAssessmentSchema);