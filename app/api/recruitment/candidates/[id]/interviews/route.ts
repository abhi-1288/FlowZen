import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const interviews = await ATSInterview.find({ candidate: id, company: user.company })
    .sort({ scheduledAt: -1 })
    .populate("interviewer", "name email")
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  return NextResponse.json({ interviews: serializeDocs(interviews) });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  const body = await request.json();
  if (!body.interviewer) return jsonError("Interviewer is required.");
  if (!body.scheduledAt) return jsonError("Scheduled date is required.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company }).populate("job", "title");
  if (!candidate) return jsonError("Candidate not found.", 404);

  const jobId = candidate.job && typeof candidate.job === "object" ? (candidate.job as any)._id || (candidate.job as any).id : candidate.job;

  const interview = await ATSInterview.create({
    candidate: candidate._id,
    job: jobId,
    interviewer: body.interviewer,
    roundType: body.roundType || "screening",
    scheduledAt: new Date(body.scheduledAt),
    meetingLink: String(body.meetingLink ?? "").trim(),
    status: "scheduled",
    createdBy: userId,
    company: user.company,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: jobId,
    action: "interview-scheduled",
    metadata: { roundType: body.roundType || "screening", scheduledAt: body.scheduledAt, interviewerId: body.interviewer },
    actor: userId,
    company: user.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "schedule-interview",
    entityType: "ATSInterview",
    entityId: interview._id,
    metadata: { candidateName: `${candidate.firstName} ${candidate.lastName}`, roundType: body.roundType || "screening" },
    company: user.company,
  });

  emitToUser(String(body.interviewer), "notification:new", {
    message: `Interview scheduled for ${candidate.firstName} ${candidate.lastName} (${body.roundType || "screening"}).`,
  });

  await Notification.create({
    user: body.interviewer,
    type: "info",
    title: "Interview Scheduled",
    message: `You have an interview with ${candidate.firstName} ${candidate.lastName} on ${new Date(body.scheduledAt).toLocaleDateString()}.`,
  });

  const populated = await ATSInterview.findById(interview._id)
    .populate("interviewer", "name email")
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  return NextResponse.json({ interview: serializeDocs([populated!])[0] }, { status: 201 });
}
