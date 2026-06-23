import { Schema, model, models, type InferSchemaType } from "mongoose";

const InterviewFeedbackSchema = new Schema(
  {
    technicalSkills: { type: Number, default: 1, min: 1, max: 5 },
    communication: { type: Number, default: 1, min: 1, max: 5 },
    problemSolving: { type: Number, default: 1, min: 1, max: 5 },
    cultureFit: { type: Number, default: 1, min: 1, max: 5 },
    overallRecommendation: {
      type: String,
      enum: ["strong-hire", "hire", "hold", "reject"],
      default: "hold",
    },
    notes: { type: String, default: "", maxlength: 2000 },
  },
  { _id: false }
);

const ATSInterviewSchema = new Schema(
  {
    candidate: { type: Schema.Types.ObjectId, ref: "ATSCandidate", required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true, index: true },
    interviewer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roundType: {
      type: String,
      enum: ["screening", "technical", "manager", "hr"],
      required: true,
    },
    scheduledAt: { type: Date, required: true },
    meetingLink: { type: String, default: "" },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "rescheduled"],
      default: "scheduled",
    },
    feedback: { type: InterviewFeedbackSchema, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  },
  { timestamps: true }
);

ATSInterviewSchema.index({ company: 1, scheduledAt: 1 });
ATSInterviewSchema.index({ interviewer: 1, scheduledAt: 1 });

export type ATSInterviewDocument = InferSchemaType<typeof ATSInterviewSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSInterview;
}

export const ATSInterview = (models as any).ATSInterview || model("ATSInterview", ATSInterviewSchema);
