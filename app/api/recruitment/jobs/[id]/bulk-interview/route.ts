import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import { sendMail } from "@/lib/mailer";
import { interviewScheduledEmail } from "@/lib/email-templates";
import { buildOrigin, buildPortalLink, resolveCandidatePortalToken, createUniqueGuestPassCode } from "@/lib/candidate-portal";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];
const REC_ROLES = ["admin", "human-resource", "project-manager", "qa-tester", "finance"];

const ROUND_TO_STAGE: Record<string, string> = {
  screening: "screening",
  technical: "technical-interview",
  manager: "manager-round",
  hr: "hr-round",
};
const STAGE_ORDER = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("_id title");
  if (!job) return jsonError("Job not found.", 404);

  const body = await request.json();
  if (!body.interviewer) return jsonError("Interviewer is required.");
  if (!body.scheduledAt) return jsonError("Scheduled date is required.");
  const candidateIds: string[] = Array.isArray(body.candidateIds) ? body.candidateIds.filter((c: unknown) => isObjectId(c as string)) : [];
  if (candidateIds.length === 0) return jsonError("Select at least one candidate.");

  const roundType: string = body.roundType || "screening";
  const meetingLink = String(body.meetingLink ?? "").trim();
  const location = String(body.location ?? "").trim();
  const scheduledAt = new Date(body.scheduledAt);

  const candidates: any[] = await ATSCandidate.find({
    _id: { $in: candidateIds },
    job: job._id,
    company: user.company,
  }).populate("job", "title");

  const byId = new Map<string, any>(candidates.map((c) => [String(c._id), c]));

  const interviewerUser = await User.findById(body.interviewer).select("name email role");

  const origin = buildOrigin(request);

  let created = 0;
  let advanced = 0;
  for (const rawId of candidateIds) {
    const candidate = byId.get(rawId);
    if (!candidate) continue;

    try {
      const passCode =
        !meetingLink && location ? await createUniqueGuestPassCode(String(user.company)) : "";
      const isInPerson = !meetingLink && location;
      const interview = await ATSInterview.create({
        candidate: candidate._id,
        job: job._id,
        interviewer: body.interviewer,
        roundType,
        scheduledAt,
        meetingLink,
        location,
        passCode,
        passValidFrom: isInPerson ? new Date(scheduledAt.getTime() - 15 * 60 * 1000) : null,
        passValidUntil: isInPerson ? new Date(scheduledAt.getTime() + 15 * 60 * 1000) : null,
        status: "scheduled",
        createdBy: userId,
        company: user.company,
      });

      try {
        const teamRole = interviewerUser?.role || "project-manager";
        const cand = await ATSCandidate.findById(candidate._id);
        if (cand) {
          const team = (cand as any).assignedTeam || [];
          const existing = team.find((t: any) => t.role === teamRole);
          if (existing) {
            existing.user = body.interviewer;
            existing.roundType = roundType;
            existing.status = "assigned";
          } else {
            team.push({ role: teamRole, user: body.interviewer, roundType, status: "assigned", feedback: "" });
          }
          (cand as any).assignedTeam = team;
          await cand.save();
        }
      } catch (teamErr) {
        console.error("Failed to sync assigned team on bulk schedule:", teamErr);
      }

      await ATSTimeline.create({
        candidate: candidate._id,
        job: job._id,
        action: "interview-scheduled",
        metadata: { roundType, scheduledAt: String(scheduledAt), interviewerId: body.interviewer, location },
        actor: userId,
        company: user.company,
      });

      await ATSAuditLog.create({
        actor: userId,
        action: "schedule-interview",
        entityType: "ATSInterview",
        entityId: interview._id,
        metadata: { candidateName: `${candidate.firstName} ${candidate.lastName}`, roundType },
        company: user.company,
      });

      const currentStage = candidate.stage as string;
      const targetStage = ROUND_TO_STAGE[roundType];
      if (targetStage) {
        const currentIdx = STAGE_ORDER.indexOf(currentStage);
        const targetIdx = STAGE_ORDER.indexOf(targetStage);
        if (targetIdx > currentIdx && targetIdx >= 0) {
          (candidate as any).stage = targetStage;
          await candidate.save();
          await ATSTimeline.create({
            candidate: candidate._id,
            job: job._id,
            action: "stage-changed",
            metadata: { from: currentStage, to: targetStage, reason: "Interview scheduled" },
            actor: userId,
            company: user.company,
          });
          advanced++;
        }
      }

      const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim();
      const ivDate = scheduledAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const meetingInfo = meetingLink ? `\nMeeting Link: ${meetingLink}` : location ? `\nLocation: ${location}` : "";

      emitToUser(String(body.interviewer), "notification:new", {
        message: `Interview scheduled for ${candidateName} (${roundType}) on ${ivDate}.${meetingInfo}`,
      });
      await Notification.create({
        user: body.interviewer,
        type: "info",
        title: "Interview Scheduled",
        body: `${roundType} round with ${candidateName} on ${ivDate}.${meetingInfo}`,
      });

      try {
        const jobTitle = (candidate.job as any)?.title ?? "Position";
        if (interviewerUser?.email) {
          const interviewerEmail = interviewScheduledEmail({ candidateName, jobTitle, roundType, scheduledAt, meetingLink, location });
          await sendMail({ to: interviewerUser.email, subject: interviewerEmail.subject, text: "", html: interviewerEmail.html });
        }
        if (candidate.email) {
          const candidateToken = await resolveCandidatePortalToken(String(candidate._id));
          const portalLink = buildPortalLink(origin, candidateToken);
          const candidateEmail = interviewScheduledEmail({ candidateName, jobTitle, roundType, scheduledAt, meetingLink, location, portalLink });
          await sendMail({ to: candidate.email, subject: candidateEmail.subject, text: "", html: candidateEmail.html });
        }
      } catch (emailErr) {
        console.error("Failed to send interview email:", emailErr);
      }

      created++;
    } catch (err) {
      console.error("Failed to schedule interview for candidate:", rawId, err);
    }
  }

  const recUsers = await User.find({ company: user.company, role: { $in: REC_ROLES }, _id: { $ne: userId } });
  for (const ru of recUsers) {
    emitToUser(String(ru._id), "recruitment:update", { type: "interview-scheduled", jobId: id });
  }

  const jobTitle = (job as any).title || "Position";
  const hrAndAdmin = await User.find({ company: user.company, role: { $in: HR_ROLES }, _id: { $ne: userId } });
  for (const u of hrAndAdmin) {
    await Notification.create({
      user: u._id,
      company: user.company,
      type: "info",
      title: "Bulk Interview Scheduled",
      message: `${created} interview(s) scheduled for ${jobTitle} (${roundType}).`,
      link: `/recruitment/jobs/${id}`,
    });
    emitToUser(String(u._id), "recruitment:update", { type: "interview-scheduled", jobId: id });
  }

  return NextResponse.json({ created, advanced });
}
