import { NextResponse } from "next/server";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { withCandidateAccess } from "@/lib/recruitment-candidate-access";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { jsonError, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };
const VALID_STAGES = ["applied", "screening", "assessment", "technical-interview", "manager-round", "hr-round", "offer", "joined", "ats-rejected", "rejected"];

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const access = await withCandidateAccess(id, "write");
  if (!access.ok) return access.response;
  const { user, candidate: loaded } = access;
  const userId = String(user._id);

  // Moving a candidate through the pipeline is the main office's call. A region
  // can still receive a candidate and take them to offer, but the screening /
  // assessment / interview progression belongs to whoever raised the requisition.
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;

  const body = await request.json();
  const toStage = String(body.stage ?? "");
  if (!VALID_STAGES.includes(toStage)) return jsonError("Invalid stage.");

  const candidate = await ATSCandidate.findById(loaded._id)
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");
  if (!candidate) return jsonError("Candidate not found.", 404);

  const fromStage = candidate.stage;

  // When moving backward to a pre-assessment stage, reset assessment state
  // so the candidate can restart the assessment.
  const ASSESSMENT_STAGES = ["assessment", "technical-interview", "manager-round", "hr-round", "offer", "joined"];
  const PRE_ASSESSMENT_STAGES = ["applied", "screening"];
  if (ASSESSMENT_STAGES.includes(fromStage) && PRE_ASSESSMENT_STAGES.includes(toStage)) {
    candidate.assessmentStartedAt = null;
    candidate.assessmentSlotStart = null;
    candidate.assessmentSubmittedAt = null;
    candidate.assessmentInviteSentAt = null;
    candidate.assessmentResultPublishedAt = null;
    candidate.assessmentScore = null;
    candidate.assessmentStatus = "pending";
    candidate.assessmentReason = "";
    candidate.assessmentRejectionNote = "";
    candidate.assessmentDomain = "";
    candidate.assessmentRawMarks = null;
    candidate.assessmentMaxMarks = null;
    candidate.assessmentAnswers = [];
    // Proctoring counters and granted time belong to the attempt being cleared.
    // Carrying the grace over would silently hand a restarted paper extra time,
    // and a stale `pausedAt` would strand the next interruption's timer.
    candidate.assessmentProctoring = {
      violations: 0,
      noiseWarnings: 0,
      graceMs: 0,
      extensionMs: 0,
      pausedAt: null,
      peakNoiseDb: -100,
      multiFaceEvents: 0,
      screenShareAttempts: 0,
      exempt: false,
      exemptReason: "",
      extensionRequestStatus: "none",
      extensionRequestedMs: 0,
      extensionRequestNote: "",
      extensionDecidedAt: null,
      log: [],
    };
  }

  candidate.stage = toStage as typeof candidate.stage;
  await candidate.save();

  await ATSTimeline.create({
    candidate: candidate._id,
    job: candidate.job,
    action: toStage === "joined" ? "joined" : toStage === "rejected" ? "rejected" : "stage-changed",
    metadata: { from: fromStage, to: toStage },
    actor: userId,
    company: user.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "stage-change",
    entityType: "ATSCandidate",
    entityId: candidate._id,
    metadata: { name: `${candidate.firstName} ${candidate.lastName}`, from: fromStage, to: toStage },
    company: user.company,
  });

  const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim();
  const jobTitle = (candidate.job as any)?.title || "a position";

  const hrAndAdmin = await User.find({
    company: user.company,
    role: { $in: ["admin", "human-resource"] },
  });
  for (const u of hrAndAdmin) {
    if (String(u._id) === String(userId)) continue;
    await Notification.create({
      user: u._id,
      company: user.company,
      type: "info",
      title: "Candidate Stage Changed",
      message: `${candidateName} moved from ${fromStage} to ${toStage} for ${jobTitle}.`,
      link: `/recruitment/candidates/${candidate._id}`,
    });
    emitToUser(String(u._id), "notification:new", {
      message: `${candidateName} moved to ${toStage} for ${jobTitle}.`,
    });
    emitToUser(String(u._id), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
  }

  if (toStage === "manager-round") {
    const managers = await User.find({ company: user.company, role: "project-manager" });
    for (const manager of managers) {
      await Notification.create({
        user: manager._id,
        type: "info",
        title: "Manager Round Ready",
        message: `${candidateName} reached Manager Round for ${jobTitle}.`,
      });
      emitToUser(String(manager._id), "notification:new", {
        message: `${candidateName} reached Manager Round.`,
      });
      emitToUser(String(manager._id), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
    }
  }

  const otherRecruitmentRoles = await User.find({ company: user.company, role: { $in: ["project-manager", "qa-tester", "finance"] }, _id: { $ne: userId } });
  for (const u of otherRecruitmentRoles) {
    emitToUser(String(u._id), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
  }

  const refreshed = await ATSCandidate.findById(candidate._id)
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");

  return NextResponse.json({ candidate: serializeDoc(refreshed!) });
}
