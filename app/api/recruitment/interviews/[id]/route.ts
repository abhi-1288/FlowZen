import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { canStartInterview } from "@/lib/interview-utils";
import { createInterviewRoom, getInterviewInviteExpiry } from "@/lib/interview-room";
import {
  isExternalVideoProvider,
  normalizeExternalMeetingLink,
  normalizeMeetingPassword,
  normalizeVideoProvider,
  videoProviderLabel,
  type VideoProvider,
} from "@/lib/interview-provider";
import { assertFlowZenQuota } from "@/lib/interview-quota";
import { sendMail } from "@/lib/mailer";
import { interviewRescheduledEmail, interviewCancelledEmail } from "@/lib/email-templates";
import { buildOrigin, buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { purgeSignalingRoom } from "@/lib/signaling/purge";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];
const INTERVIEWER_STATUSES = ["in-progress", "scheduled"];

function interviewDetailDto(interview: any, userId: string, userRole: string) {
  const candidate = interview.candidate;
  const job = interview.job;
  const interviewer = interview.interviewer;
  const createdBy = interview.createdBy;
  const feedback = interview.feedback?.toObject?.() ?? interview.feedback;

  return {
    id: String(interview._id),
    candidate: candidate
      ? {
          id: String(candidate._id),
          firstName: candidate.firstName ?? "",
          lastName: candidate.lastName ?? "",
          email: candidate.email ?? "",
          phone: candidate.phone ?? "",
          stage: candidate.stage ?? "",
          resumeUrl: candidate.resumeUrl ?? "",
          atsScore: candidate.atsScore ?? null,
          atsStatus: candidate.atsStatus ?? "pending",
          assessmentScore: candidate.assessmentScore ?? null,
          assessmentStatus: candidate.assessmentStatus ?? "pending",
          assessmentRawMarks: candidate.assessmentRawMarks ?? null,
          assessmentMaxMarks: candidate.assessmentMaxMarks ?? null,
        }
      : null,
    job: job
      ? {
          id: String(job._id),
          title: job.title ?? "",
          requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills : [],
          description: job.description ?? "",
        }
      : null,
    interviewer: interviewer
      ? {
          id: String(interviewer._id),
          name: interviewer.name ?? "",
          email: interviewer.email ?? "",
        }
      : null,
    roundType: interview.roundType,
    scheduledAt: new Date(interview.scheduledAt).toISOString(),
    meetingType: interview.meetingType,
    videoProvider: interview.meetingType === "in-person" ? "flowzen" : normalizeVideoProvider(interview.videoProvider) ?? "flowzen",
    meetingLink: interview.meetingType === "in-person" ? "" : interview.meetingLink ?? "",
    meetingPassword: interview.meetingType === "in-person" ? "" : interview.meetingPassword ?? "",
    location: interview.location ?? "",
    status: interview.status,
    feedback: feedback ?? null,
    createdBy: createdBy
      ? {
          id: String(createdBy._id),
          name: createdBy.name ?? "",
          companyIdentityCode: createdBy.companyIdentityCode ?? "",
        }
      : null,
    canManage: HR_ROLES.includes(userRole),
    isAssignedInterviewer: String(interview.interviewer?._id ?? interview.interviewer) === userId,
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid interview id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user?.company) return jsonError("Forbidden", 403);

  const interview = await ATSInterview.findOne({ _id: id, company: user.company })
    .populate("candidate", "firstName lastName email phone stage resumeUrl atsScore atsStatus assessmentScore assessmentStatus assessmentRawMarks assessmentMaxMarks")
    .populate("job", "title requiredSkills description")
    .populate("interviewer", "name email")
    .populate("createdBy", "name companyIdentityCode");

  if (!interview) return jsonError("Interview not found.", 404);

  const isHr = HR_ROLES.includes(user.role);
  const isAssignedInterviewer = String((interview as any).interviewer?._id ?? (interview as any).interviewer) === userId;
  if (!isHr && !isAssignedInterviewer) return jsonError("Forbidden", 403);

  return NextResponse.json(
    { interview: interviewDetailDto(interview, userId, user.role) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid interview id.");

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const requestedMeetingType =
    body.meetingType === "in-person" || body.meetingType === "video"
      ? (body.meetingType as "video" | "in-person")
      : null;
  if (body.scheduledAt !== undefined) updates.scheduledAt = new Date(body.scheduledAt);
  if (body.status !== undefined) updates.status = body.status;
  if (body.roundType !== undefined) updates.roundType = body.roundType;
  if (body.interviewer !== undefined) updates.interviewer = body.interviewer;

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const existing = await ATSInterview.findOne({ _id: id, company: user.company })
    .select("+videoRoomTokenHash +videoRoomTokenExpiresAt");
  if (!existing) return jsonError("Interview not found.", 404);

  if (requestedMeetingType === "in-person") {
    const location = String(body.location ?? "").trim();
    if (!location) return jsonError("A location is required for in-person interviews.", 400);
    updates.meetingType = "in-person";
    updates.location = location;
    updates.meetingLink = "";
    updates.meetingPassword = "";
    updates.videoProvider = "flowzen";
    updates.videoRoomTokenHash = "";
    updates.videoRoomTokenExpiresAt = null;
  } else if (requestedMeetingType === "video") {
    updates.meetingType = "video";
    updates.location = "";

    // Resolve the hosting mode. Omitting videoProvider keeps whatever the
    // interview already uses, so unrelated edits do not reset the meeting.
    const requestedProvider = normalizeVideoProvider(body.videoProvider);
    const provider: VideoProvider =
      requestedProvider ?? normalizeVideoProvider(existing.videoProvider) ?? "flowzen";
    const externalRequested = isExternalVideoProvider(provider);

    if (externalRequested) {
      const normalized = normalizeExternalMeetingLink(provider, body.meetingLink ?? existing.meetingLink);
      if (!normalized.ok) return jsonError(normalized.error, 400);
      updates.videoProvider = provider;
      updates.meetingLink = normalized.url;
      updates.meetingPassword = normalizeMeetingPassword(
        body.meetingPassword ?? existing.meetingPassword
      );
      // An external meeting supersedes any FlowZen room on this interview.
      updates.videoRoomTokenHash = "";
      updates.videoRoomTokenExpiresAt = null;
    } else {
      updates.videoProvider = "flowzen";
      updates.meetingPassword = "";
    }
  } else if (body.location !== undefined) {
    updates.location = String(body.location).trim();
  }

  const isHr = HR_ROLES.includes(user.role);
  const isAssignedInterviewer = String((existing as any).interviewer) === String(userId);

  if (!isHr && !isAssignedInterviewer) return jsonError("Forbidden", 403);

  if (!isHr) {
    if (Object.keys(body).some((key) => key !== "status")) {
      return jsonError("You can only update the status of your interview.", 400);
    }
    if (!INTERVIEWER_STATUSES.includes(body.status)) {
      return jsonError("Invalid status update.", 400);
    }
  }

  const scheduleChanged = body.scheduledAt !== undefined;
  let roomRotated = false;
  const effectiveScheduledAt = updates.scheduledAt ?? existing.scheduledAt;

  if (requestedMeetingType === "video" && !isExternalVideoProvider(updates.videoProvider) && !existing.videoRoomTokenHash) {
    // Switching an interview onto a FlowZen room consumes a slot in the
    // company's monthly allowance.
    const quota = await assertFlowZenQuota(user.company, 1);
    if (!quota.ok) return jsonError(quota.error, 409);

    const [candidateDoc, jobDoc] = await Promise.all([
      ATSCandidate.findById(existing.candidate).select("firstName lastName"),
      ATSJob.findById(existing.job).select("title"),
    ]);
    const candidateName = `${candidateDoc?.firstName ?? ""} ${candidateDoc?.lastName ?? ""}`.trim() || "Candidate";
    const room = createInterviewRoom(buildOrigin(request), jobDoc?.title ?? "Position", candidateName, effectiveScheduledAt);
    updates.meetingLink = room.meetingLink;
    updates.videoRoomTokenHash = room.tokenHash;
    updates.videoRoomTokenExpiresAt = room.expiresAt;
    roomRotated = true;
  } else if (scheduleChanged && existing.videoRoomTokenHash) {
    const nextExpiry = getInterviewInviteExpiry(effectiveScheduledAt);
    const currentExpiry = existing.videoRoomTokenExpiresAt ? new Date(existing.videoRoomTokenExpiresAt).getTime() : 0;
    if (nextExpiry.getTime() > currentExpiry) updates.videoRoomTokenExpiresAt = nextExpiry;
  }

  const wasRescheduled = scheduleChanged || roomRotated;
  const wasCancelled = body.status === "cancelled";

  if (body.status === "in-progress") {
    const canStart = await canStartInterview(id, String(user.company));
    if (!canStart.ok) return jsonError(canStart.reason, 400);
  }

  const interview = await ATSInterview.findOneAndUpdate(
    { _id: id, company: user.company },
    { $set: updates },
    { new: true }
  )
    .populate("interviewer", "name email")
    .populate("candidate", "firstName lastName email portalAccessToken")
    .populate("job", "title");

  if (!interview) return jsonError("Interview not found.", 404);

  if (scheduleChanged) {
    await ATSTimeline.create({
      candidate: interview.candidate,
      job: interview.job,
      action: "interview-scheduled",
      metadata: { rescheduled: true, newDate: body.scheduledAt, roundType: interview.roundType },
      actor: userId,
      company: user.company,
    });
  }

  // HR can move an interview straight to a terminal status here, bypassing the
  // feedback endpoint, so this path has to clean up the signalling room too.
  // Awaited but never fatal — see lib/signaling/purge.ts.
  if (interview.status === "completed" || interview.status === "cancelled") {
    const purge = await purgeSignalingRoom(existing.videoRoomTokenHash);
    if (purge.purged) console.log(`[signaling] ${purge.detail}`);
  }

  await ATSAuditLog.create({
    actor: userId,
    action: wasCancelled
      ? "cancel-interview"
      : scheduleChanged
        ? "reschedule-interview"
        : body.status === "in-progress"
          ? "start-interview"
          : "update-interview",
    entityType: "ATSInterview",
    entityId: interview._id,
    metadata: { status: interview.status, roundType: interview.roundType },
    company: user.company,
  });

  // Send email notifications
  try {
    const companyDoc = await Company.findById(user.company).select("name icon");
    const candidateName = `${(interview.candidate as any)?.firstName ?? ""} ${(interview.candidate as any)?.lastName ?? ""}`.trim();
    const jobTitle = (interview.job as any)?.title ?? "Position";
    const scheduledAt = interview.scheduledAt;
    const meetingLink = interview.meetingLink || undefined;
    const meetingPassword = interview.meetingPassword || undefined;
    const meetingProvider = isExternalVideoProvider(interview.videoProvider)
      ? videoProviderLabel(interview.videoProvider)
      : undefined;
    const location = interview.location || undefined;

    if (wasCancelled) {
      const candidateToken = await resolveCandidatePortalToken(String((interview.candidate as any)._id));
      const portalLink = buildPortalLink(buildOrigin(request), candidateToken);
      const candidateEmail = interviewCancelledEmail({ candidateName, jobTitle, roundType: interview.roundType, portalLink, company: { name: (companyDoc as any)?.name, icon: (companyDoc as any)?.icon } });
      if ((interview.candidate as any)?.email) {
        await sendMail({ to: (interview.candidate as any).email, subject: candidateEmail.subject, text: "", html: candidateEmail.html });
      }
      if ((interview.interviewer as any)?.email) {
        await sendMail({ to: (interview.interviewer as any).email, subject: candidateEmail.subject, text: "", html: candidateEmail.html });
      }
    } else if (wasRescheduled) {
      const candidateToken = await resolveCandidatePortalToken(String((interview.candidate as any)._id));
      const portalLink = buildPortalLink(buildOrigin(request), candidateToken);
      // Candidates enter through the portal; the interviewer keeps the direct
      // link because they are already session-authenticated.
      const candidateEmail = interviewRescheduledEmail({ candidateName, jobTitle, roundType: interview.roundType, scheduledAt, meetingLink, meetingPassword, meetingProvider, location, portalLink, hideJoinButton: true, company: { name: (companyDoc as any)?.name, icon: (companyDoc as any)?.icon } });
      if ((interview.candidate as any)?.email) {
        await sendMail({ to: (interview.candidate as any).email, subject: candidateEmail.subject, text: "", html: candidateEmail.html });
      }
      if ((interview.interviewer as any)?.email) {
        const interviewerEmail = interviewRescheduledEmail({ candidateName, jobTitle, roundType: interview.roundType, scheduledAt, meetingLink, meetingPassword, meetingProvider, location, company: { name: (companyDoc as any)?.name, icon: (companyDoc as any)?.icon } });
        await sendMail({ to: (interview.interviewer as any).email, subject: interviewerEmail.subject, text: "", html: interviewerEmail.html });
      }
    }
  } catch (emailErr) {
    console.error("Failed to send interview email:", emailErr);
  }

  return NextResponse.json({ interview: serializeDoc(interview) });
}
