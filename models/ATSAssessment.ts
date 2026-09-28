import { Schema, model, models, type InferSchemaType } from "mongoose";
import {
  DEFAULT_PROCTORING,
  MAX_NOISE_THRESHOLD_DB,
  MIN_NOISE_THRESHOLD_DB,
} from "@/lib/assessment-proctoring";
import {
  DEFAULT_MOCK_QUESTION_PERCENT,
  MAX_MOCK_ATTEMPTS,
  MAX_MOCK_DURATION_MINUTES,
  MAX_MOCK_QUESTION_PERCENT,
  MAX_MOCK_RESULT_DELAY_HOURS,
  MIN_MOCK_ATTEMPTS,
  MIN_MOCK_DURATION_MINUTES,
  MIN_MOCK_QUESTION_PERCENT,
  MIN_MOCK_RESULT_DELAY_HOURS,
  MOCK_RESULT_RELEASES,
} from "@/lib/assessment-mock";

/**
 * Proctoring settings. Defaults come from lib/assessment-proctoring.ts so the
 * stored shape and the maths that reads it cannot drift apart.
 */
const ProctoringSchema = new Schema(
  {
    enabled: { type: Boolean, default: DEFAULT_PROCTORING.enabled },
    requireCamera: { type: Boolean, default: DEFAULT_PROCTORING.requireCamera },
    requireMic: { type: Boolean, default: DEFAULT_PROCTORING.requireMic },
    requireFullscreen: { type: Boolean, default: DEFAULT_PROCTORING.requireFullscreen },
    blockOnFocusLoss: { type: Boolean, default: DEFAULT_PROCTORING.blockOnFocusLoss },
    noiseThresholdDb: {
      type: Number,
      default: DEFAULT_PROCTORING.noiseThresholdDb,
      min: MIN_NOISE_THRESHOLD_DB,
      max: MAX_NOISE_THRESHOLD_DB,
    },
    noiseWarningLimit: { type: Number, default: DEFAULT_PROCTORING.noiseWarningLimit, min: 0, max: 20 },
    requireSingleFace: { type: Boolean, default: DEFAULT_PROCTORING.requireSingleFace },
    blockScreenShare: { type: Boolean, default: DEFAULT_PROCTORING.blockScreenShare },
  },
  { _id: false }
);

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

const ATSAssessmentTimeSlotSchema = new Schema(
  {
    start: { type: String, required: true, trim: true, maxlength: 5 },
  },
  { _id: false }
);

/**
 * Optional practice paper drawn from this assessment's own question bank, sat
 * under the same clock and proctoring but on a separate track — see
 * lib/assessment-mock.ts for the sampling, window and release rules. The
 * sub-schema exists only so the stored shape is validated at the door;
 * `durationMinutes: null` deliberately means "inherit the job's duration".
 */
const MockTestConfigSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    opensAt: { type: Date, default: null },
    closesAt: { type: Date, default: null },
    durationMinutes: {
      type: Number,
      default: null,
      min: MIN_MOCK_DURATION_MINUTES,
      max: MAX_MOCK_DURATION_MINUTES,
    },
    questionPercent: {
      type: Number,
      default: DEFAULT_MOCK_QUESTION_PERCENT,
      min: MIN_MOCK_QUESTION_PERCENT,
      max: MAX_MOCK_QUESTION_PERCENT,
    },
    shuffleQuestions: { type: Boolean, default: true },
    resultRelease: { type: String, enum: MOCK_RESULT_RELEASES, default: "immediate" },
    resultDelayHours: {
      type: Number,
      default: 0,
      min: MIN_MOCK_RESULT_DELAY_HOURS,
      max: MAX_MOCK_RESULT_DELAY_HOURS,
    },
    showAnswerKey: { type: Boolean, default: true },
    maxAttempts: {
      type: Number,
      default: 1,
      min: MIN_MOCK_ATTEMPTS,
      max: MAX_MOCK_ATTEMPTS,
    },
    lastInvitedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ATSAssessmentSchema = new Schema(
  {
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true, unique: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    passScore: { type: Number, default: 50, min: 0, max: 100 },
    negativeMarking: { type: Number, default: 0, min: 0, max: 100 },
    // Display aid only: the reduced fraction HR typed ("1/4"). `negativeMarking`
    // stays authoritative for scoring; this is re-validated against it on write.
    negativeMarkingLabel: { type: String, default: "", trim: true, maxlength: 40 },
    // "uniform" pins every candidate who picks a slot to that slot's fixed end;
    // "relief" lets each candidate start any time and run the full duration.
    windowMode: { type: String, enum: ["uniform", "relief"], default: "relief" },
    // "HH:mm" start times on the assessment date's day. Empty means a single
    // slot derived from the job's assessmentDate.
    timeSlots: { type: [ATSAssessmentTimeSlotSchema], default: [] },
    // Camera/mic/fullscreen enforcement for the sitting. Sub-schema defaults
    // come from lib/assessment-proctoring.ts.
    proctoring: { type: ProctoringSchema, default: () => ({}) },
    instructions: { type: String, default: "", trim: true, maxlength: 2000 },
    questions: { type: [ATSAssessmentQuestionSchema], default: [] },
    domains: { type: [ATSAssessmentDomainSchema], default: [] },
    // Practice-paper settings. Absent or partial configs are normal (a job may
    // never have used one), so the maths goes through resolveMockTestConfig().
    mockTest: { type: MockTestConfigSchema, default: () => ({}) },
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