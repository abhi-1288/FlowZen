import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid interview id.");

  const body = await request.json();
  const feedback = body.feedback;
  if (!feedback) return jsonError("Feedback is required.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const interview = await ATSInterview.findOne({ _id: id, company: user.company });
  if (!interview) return jsonError("Interview not found.", 404);

  if (String(interview.interviewer) !== userId && user.role !== "admin" && user.role !== "human-resource") {
    return jsonError("Only the interviewer or HR can provide feedback.", 403);
  }

  interview.feedback = {
    technicalSkills: Math.min(5, Math.max(1, Number(feedback.technicalSkills) || 0)),
    communication: Math.min(5, Math.max(1, Number(feedback.communication) || 0)),
    problemSolving: Math.min(5, Math.max(1, Number(feedback.problemSolving) || 0)),
    cultureFit: Math.min(5, Math.max(1, Number(feedback.cultureFit) || 0)),
    overallRecommendation: feedback.overallRecommendation || "hold",
    notes: String(feedback.notes ?? "").trim(),
  };
  interview.status = "completed";
  await interview.save();

  await ATSTimeline.create({
    candidate: interview.candidate,
    job: interview.job,
    action: "interview-completed",
    metadata: { roundType: interview.roundType, recommendation: interview.feedback.overallRecommendation },
    actor: userId,
    company: user.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "add-feedback",
    entityType: "ATSInterview",
    entityId: interview._id,
    metadata: { roundType: interview.roundType, recommendation: interview.feedback.overallRecommendation },
    company: user.company,
  });

  const interviewerName = user.name || "An interviewer";
  const cand = await ATSCandidate.findById(interview.candidate).select("firstName lastName").lean();
  const candidateName = cand ? `${cand.firstName} ${cand.lastName}`.trim() : "the candidate";
  const recommendation = interview.feedback.overallRecommendation;

  const hrUsers = await User.find({ company: user.company, role: { $in: ["admin", "human-resource"] } }).select("_id").lean();
  const hrMessage = `${interviewerName} marked "${interview.roundType}" round as done for ${candidateName} with recommendation: ${recommendation}.`;

  for (const hr of hrUsers) {
    const hrId = String(hr._id);
    emitToUser(hrId, "notification:new", { message: hrMessage });
    await Notification.create({
      user: hrId,
      type: "info",
      title: `${interview.roundType} Round Completed`,
      body: `${interviewerName} completed the ${interview.roundType} round for ${candidateName}. Recommendation: ${recommendation}.`,
    });
  }

  const populated = await ATSInterview.findById(interview._id)
    .populate("interviewer", "name email")
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  return NextResponse.json({ interview: serializeDoc(populated!) });
}
