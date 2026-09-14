import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { emitToUser } from "@/lib/socket-emit";

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const candidateId = String(body.candidateId || "").trim();
  const status = body.status === "selected" || body.status === "rejected" ? body.status : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!candidateId) return jsonError("candidateId is required.", 400);
  if (!status) return jsonError("status must be 'selected' or 'rejected'.", 400);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("_id assessment");
  if (!job) return jsonError("Job not found.", 404);
  if (!job.assessment) return jsonError("Online assessment is not enabled for this job.", 400);

  const candidate = await ATSCandidate.findOne({ _id: candidateId, job: id, company: user.company });
  if (!candidate) return jsonError("Candidate not found.", 404);
  if (candidate.assessmentStatus !== "pending" || !(candidate as any).assessmentSubmittedAt) {
    return jsonError("This candidate's assessment is not pending manual review.", 400);
  }

  const score = (candidate as any).assessmentScore;
  const reason = note
    ? `Manually graded: ${status === "selected" ? "Passed" : "Failed"}. ${note}`
    : `Manually graded: ${status === "selected" ? "Passed" : "Failed"} via essay review.${score != null ? ` MCQ score: ${score}/100.` : ""}`;

  candidate.assessmentStatus = status;
  (candidate as any).assessmentReason = reason;
  (candidate as any).assessmentRejectionNote = status === "rejected" ? reason : "";
  await candidate.save();

  emitToUser(String(userId), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });

  return NextResponse.json({ ok: true, status, candidateId: String(candidate._id) });
  } catch (err: any) {
    if (err?.name === "ValidationError" && err?.errors) {
      const first = Object.values(err.errors)
        .map((e: any) => e.message)
        .find(Boolean);
      if (first) return jsonError(String(first), 400);
    }
    console.error("[assessment grade-essay POST]", err);
    return jsonError(err?.message || "Failed to grade the essay.", 500);
  }
}