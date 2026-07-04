import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import { sendMail } from "@/lib/mailer";
import { interviewRescheduledEmail, interviewCancelledEmail } from "@/lib/email-templates";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid interview id.");

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.scheduledAt !== undefined) updates.scheduledAt = new Date(body.scheduledAt);
  if (body.meetingLink !== undefined) updates.meetingLink = String(body.meetingLink).trim();
  if (body.status !== undefined) updates.status = body.status;
  if (body.roundType !== undefined) updates.roundType = body.roundType;
  if (body.interviewer !== undefined) updates.interviewer = body.interviewer;

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const wasRescheduled = body.scheduledAt !== undefined;
  const wasCancelled = body.status === "cancelled";

  const interview = await ATSInterview.findOneAndUpdate(
    { _id: id, company: user.company },
    { $set: updates },
    { new: true }
  )
    .populate("interviewer", "name email")
    .populate("candidate", "firstName lastName email")
    .populate("job", "title");

  if (!interview) return jsonError("Interview not found.", 404);

  if (wasRescheduled) {
    await ATSTimeline.create({
      candidate: interview.candidate,
      job: interview.job,
      action: "interview-scheduled",
      metadata: { rescheduled: true, newDate: body.scheduledAt, roundType: interview.roundType },
      actor: userId,
      company: user.company,
    });
  }

  await ATSAuditLog.create({
    actor: userId,
    action: wasCancelled ? "cancel-interview" : wasRescheduled ? "reschedule-interview" : "update-interview",
    entityType: "ATSInterview",
    entityId: interview._id,
    metadata: { status: interview.status, roundType: interview.roundType },
    company: user.company,
  });

  // Send email notifications
  try {
    const candidateName = `${(interview.candidate as any)?.firstName ?? ""} ${(interview.candidate as any)?.lastName ?? ""}`.trim();
    const jobTitle = (interview.job as any)?.title ?? "Position";
    const scheduledAt = interview.scheduledAt;
    const meetingLink = interview.meetingLink || undefined;

    if (wasCancelled) {
      const candidateEmail = interviewCancelledEmail({ candidateName, jobTitle, roundType: interview.roundType });
      if ((interview.candidate as any)?.email) {
        await sendMail({ to: (interview.candidate as any).email, subject: candidateEmail.subject, text: "", html: candidateEmail.html });
      }
      if ((interview.interviewer as any)?.email) {
        await sendMail({ to: (interview.interviewer as any).email, subject: candidateEmail.subject, text: "", html: candidateEmail.html });
      }
    } else if (wasRescheduled) {
      const email = interviewRescheduledEmail({ candidateName, jobTitle, roundType: interview.roundType, scheduledAt, meetingLink });
      if ((interview.candidate as any)?.email) {
        await sendMail({ to: (interview.candidate as any).email, subject: email.subject, text: "", html: email.html });
      }
      if ((interview.interviewer as any)?.email) {
        await sendMail({ to: (interview.interviewer as any).email, subject: email.subject, text: "", html: email.html });
      }
    }
  } catch (emailErr) {
    console.error("Failed to send interview email:", emailErr);
  }

  return NextResponse.json({ interview: serializeDoc(interview) });
}
