import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Proctoring record for one mock attempt. Mirrors the real attempt's
 * `assessmentProctoring` block, but lives per attempt rather than per candidate
 * so a retake starts with a clean slate and the first attempt's violations are
 * not attributed to the second. `graceMs` is folded into the mock deadline by
 * getMockDeadlineMs() in lib/assessment-mock.ts.
 */
const MockTestAttemptProctoringSchema = new Schema(
  {
    violations: { type: Number, default: 0, min: 0 },
    noiseWarnings: { type: Number, default: 0, min: 0 },
    graceMs: { type: Number, default: 0, min: 0 },
    pausedAt: { type: Date, default: null },
    peakNoiseDb: { type: Number, default: -100 },
    multiFaceEvents: { type: Number, default: 0, min: 0 },
    screenShareAttempts: { type: Number, default: 0, min: 0 },
    /** Set by HR to waive proctoring for a locked-down device. */
    exempt: { type: Boolean, default: false },
    log: {
      type: [
        {
          at: { type: Date, default: Date.now },
          kind: { type: String, default: "violation", maxlength: 40 },
          detail: { type: String, default: "", maxlength: 500 },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

/**
 * One sitting of the mock test.
 *
 * `questionIndices` is the load-bearing field: the indices into
 * `[...general, ...chosenDomain.questions]` that were sampled for this attempt,
 * in the exact order they were served. Grading, auto-submit and the answer key
 * all replay it, because answers are keyed by position and the sample cannot be
 * re-derived from the bank. See lib/assessment-mock.ts.
 *
 * The array is append-only and never reordered, so an in-flight attempt is
 * addressed by its numeric index and that index cannot shift underneath a write.
 */
const MockTestAttemptSchema = new Schema(
  {
    /** 1-based, so the portal can say "Attempt 2 of 3". */
    attemptNumber: { type: Number, default: 1, min: 1 },
    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    /** True when the background sweep closed this paper rather than the candidate. */
    autoSubmitted: { type: Boolean, default: false },
    domain: { type: String, default: "", trim: true, maxlength: 100 },
    questionIndices: { type: [Number], default: [] },
    // selectedOption stays null for unanswered questions, so a partial autosave
    // is not scored as a run of wrong answers.
    answers: {
      type: [
        {
          questionIndex: Number,
          selectedOption: { type: Number, default: null },
          textAnswer: { type: String, default: "" },
        },
      ],
      default: [],
    },
    score: { type: Number, default: null, min: 0, max: 100 },
    rawMarks: { type: Number, default: null },
    maxMarks: { type: Number, default: null },
    passed: { type: Boolean, default: null },
    proctoring: { type: MockTestAttemptProctoringSchema, default: () => ({}) },
  },
  { _id: false }
);

const ATSCandidateSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, default: "", trim: true, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true, maxlength: 20 },
    currentCompany: { type: String, default: "", trim: true, maxlength: 120 },
    experienceYears: { type: Number, default: 0, min: 0 },
    internshipExperienceMonths: { type: Number, default: 0, min: 0 },
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
      enum: ["applied", "screening", "assessment", "technical-interview", "manager-round", "hr-round", "offer", "joined", "ats-rejected", "rejected"],
      default: "applied",
      index: true,
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    notes: [{
      author: { type: Schema.Types.ObjectId, ref: "User", required: true },
      content: { type: String, required: true, maxlength: 2000 },
      createdAt: { type: Date, default: Date.now },
    }],
    dob: { type: Date, default: null },
    address: { type: String, default: "", trim: true, maxlength: 500 },
    resumeUrl: { type: String, default: "" },
    portfolioUrl: { type: String, default: "" },
    linkedInUrl: { type: String, default: "" },
    assignedRecruiter: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedTeam: [{
      role: { type: String, enum: ["project-manager", "qa-tester", "finance", "human-resource", "admin"] },
      user: { type: Schema.Types.ObjectId, ref: "User" },
      roundType: { type: String, default: "" },
      status: { type: String, enum: ["assigned", "in-progress", "completed"], default: "assigned" },
      feedback: { type: String, enum: ["", "suitable", "not-suitable", "on-hold"], default: "" },
    }],
    stageChangeRequest: {
      requestedStage: { type: String, default: "" },
      requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      feedback: { type: String, default: "" },
      status: { type: String, enum: ["", "pending", "approved", "rejected"], default: "" },
    },
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    // TWO DIFFERENT LABEL SPACES LIVE ON THIS MODEL. Do not conflate them.
    //
    // `regionLabel` is a GEOGRAPHIC STATE detected from the candidate's own
    // address and resume by `lib/candidate-region.ts` ("Maharashtra",
    // "Uttar Pradesh"). It powers the "State" filter in the bulk interview
    // scheduler. It says nothing about where the person will work.
    //
    // Writers must gate on `isDetectedState()` from that module. The detector
    // also returns company office labels, and those used to be written here
    // unchecked, which is the second half of the bug this model was split to fix.
    // Human edits through the candidate PATCH route are free text and are not
    // validated; treat an unrecognised value as suspect rather than trusting it.
    //
    // `joiningRegionLabel` is a COMPANY OFFICE LABEL from
    // `Company.addresses[].label` ("Noida Region"). It is set by the bulk
    // transfer in `app/api/recruitment/jobs/[id]/bulk-region/route.ts` and is
    // the single source of truth for which region owns the hire. The offer
    // inherits it, and the join approval is routed to that region's head.
    //
    // The two used to share one field, which silently broke the command
    // centre's Candidates trend: it filtered by office label against state
    // values and dropped most candidates for a regional viewer.
    regionLabel: { type: String, default: "", trim: true, maxlength: 200, index: true },
    joiningRegionLabel: { type: String, default: "", trim: true, maxlength: 200, index: true },
    // The region a candidate was transferred out of, and by whom. Kept so a
    // re-transfer is legible in the UI without replaying the whole timeline.
    previousJoiningRegionLabel: { type: String, default: "", trim: true, maxlength: 200 },
    joiningRegionAssignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    joiningRegionAssignedAt: { type: Date, default: null },
    atsScore: { type: Number, default: null, min: 0, max: 100 },
    atsStatus: { type: String, enum: ["pending", "selected", "rejected"], default: "pending", index: true },
    atsReason: { type: String, default: "" },
    atsRejectionNote: { type: String, default: "" },
    atsScoredAt: { type: Date, default: null },
    assessmentScore: { type: Number, default: null, min: 0, max: 100 },
    assessmentStatus: { type: String, enum: ["pending", "selected", "rejected"], default: "pending", index: true },
    assessmentReason: { type: String, default: "" },
    assessmentRejectionNote: { type: String, default: "" },
    assessmentStartedAt: { type: Date, default: null },
    assessmentSlotStart: { type: Date, default: null },
    assessmentSubmittedAt: { type: Date, default: null },
    assessmentInviteSentAt: { type: Date, default: null },
    // Stamped when this candidate is emailed an invite to update their
    // application. Drives the idempotent send in lib/edit-application-emails.ts,
    // and is cleared when HR re-enables editing so they are invited again.
    editApplicationInviteSentAt: { type: Date, default: null },
    assessmentResultPublishedAt: { type: Date, default: null },
    assessmentDomain: { type: String, default: "", trim: true, maxlength: 100 },
    assessmentRawMarks: { type: Number, default: null },
    assessmentMaxMarks: { type: Number, default: null },
    // selectedOption stays null for unanswered questions so an autosaved
    // partial attempt is not scored as a wrong answer.
    assessmentAnswers: {
      type: [
        {
          questionIndex: Number,
          selectedOption: { type: Number, default: null },
          textAnswer: { type: String, default: "" },
        },
      ],
      default: [],
    },
    /**
     * Proctoring outcome for this candidate's attempt. HR/Admin only — the
     * candidate projection in lib/candidate-visibility.ts is an allowlist, so
     * this never reaches the portal payload unless named there deliberately.
     *
     * `graceMs` is the extra clock handed back for time lost to fullscreen /
     * focus interruptions, and is folded into the deadline by
     * getCandidateDeadlineMs(). `extensionMs` is an HR-approved extension.
     */
    assessmentProctoring: {
      violations: { type: Number, default: 0, min: 0 },
      noiseWarnings: { type: Number, default: 0, min: 0 },
      graceMs: { type: Number, default: 0, min: 0 },
      extensionMs: { type: Number, default: 0, min: 0 },
      pausedAt: { type: Date, default: null },
      peakNoiseDb: { type: Number, default: -100 },
      multiFaceEvents: { type: Number, default: 0, min: 0 },
      screenShareAttempts: { type: Number, default: 0, min: 0 },
      /** Set by HR to waive proctoring for a locked-down device. */
      exempt: { type: Boolean, default: false },
      exemptReason: { type: String, default: "", trim: true, maxlength: 500 },
      // Time-extension request flow, driven by the candidate during the exam and
      // decided by HR. `extensionMs` above is what was actually granted.
      extensionRequestStatus: {
        type: String,
        enum: ["none", "pending", "approved", "denied"],
        default: "none",
      },
      extensionRequestedMs: { type: Number, default: 0, min: 0 },
      extensionRequestNote: { type: String, default: "", trim: true, maxlength: 500 },
      extensionDecidedAt: { type: Date, default: null },
      log: {
        type: [
          {
            at: { type: Date, default: Date.now },
            kind: { type: String, default: "violation", maxlength: 40 },
            detail: { type: String, default: "", maxlength: 500 },
          },
        ],
        default: [],
      },
    },
    /**
     * This candidate's mock-test history, entirely separate from the real
     * attempt above.
     *
     * A mock is practice: it must never write to (or be read as if it were)
     * `assessmentScore`, `assessmentStatus`, `stage`, or the timeline. The
     * candidate projection in lib/candidate-visibility.ts is an allowlist, so
     * this block stays out of the portal payload; the portal reads it only
     * through the dedicated /me mock payload, behind the release gate.
     *
     * `inviteSentAt` is the idempotency latch that stops the daily cron
     * emailing the same person every morning. `attempts` is capped by the
     * assessment's `mockTest.maxAttempts` at start time.
     */
    mockTest: {
      attempts: { type: [MockTestAttemptSchema], default: [] },
      bestScore: { type: Number, default: null, min: 0, max: 100 },
      lastSubmittedAt: { type: Date, default: null },
      inviteSentAt: { type: Date, default: null },
    },
    convertedEmail: { type: String, default: "", trim: true, lowercase: true },
    conversionOtpHash: { type: String, default: "", select: false },
    conversionOtpExpiresAt: { type: Date, default: null },
    magicTokenHash: { type: String, default: "", select: false },
    magicTokenExpiresAt: { type: Date, default: null },
    portalTokenHash: { type: String, default: "", select: false },
    portalTokenExpiresAt: { type: Date, default: null },
    portalAccessToken: { type: String, default: "" },
  },
  { timestamps: true }
);

ATSCandidateSchema.index({ company: 1, stage: 1 });
ATSCandidateSchema.index({ company: 1, job: 1 });
ATSCandidateSchema.index({ company: 1, assessmentDomain: 1 });

const REFERRAL_STAGE_MAP: Record<string, string> = {
  applied: "pending",
  screening: "reviewed",
  assessment: "reviewed",
  "technical-interview": "reviewed",
  "manager-round": "reviewed",
  "hr-round": "reviewed",
  offer: "reviewed",
  joined: "hired",
  "ats-rejected": "rejected",
  rejected: "rejected",
};

ATSCandidateSchema.post("save", async function () {
  if (this.isModified("stage")) {
    const newStatus = REFERRAL_STAGE_MAP[this.stage];
    if (newStatus) {
      try {
        const { ATSReferral } = await import("@/models/ATSReferral");
        await ATSReferral.findOneAndUpdate(
          { candidate: this._id },
          { $set: { status: newStatus } }
        );
      } catch {
        // referral sync is best-effort
      }
    }
  }
});

export type ATSCandidateDocument = InferSchemaType<typeof ATSCandidateSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSCandidate;
}

export const ATSCandidate = (models as any).ATSCandidate || model("ATSCandidate", ATSCandidateSchema);
