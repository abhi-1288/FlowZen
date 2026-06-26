import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSReferral } from "@/models/ATSReferral";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = rawLimit === 0 ? 0 : Math.min(100, Math.max(1, rawLimit));
  const skip = limit === 0 ? 0 : (page - 1) * limit;

  const filter: Record<string, unknown> = { company: user.company };
  if (user.role === "employee") filter.employee = userId;
  if (jobId) filter.job = jobId;

  const [totalCount, referrals] = await Promise.all([
    ATSReferral.countDocuments(filter),
    ATSReferral.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit || undefined)
      .populate("employee", "name email")
      .populate("candidate", "firstName lastName email stage"),
  ]);

  return NextResponse.json({ referrals: serializeDocs(referrals), totalCount, page, limit });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  if (!body.candidateId || !isObjectId(body.candidateId)) return jsonError("Valid candidate ID is required.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: body.candidateId, company: user.company });
  if (!candidate) return jsonError("Candidate not found.", 404);

  const existing = await ATSReferral.findOne({ employee: userId, candidate: body.candidateId });
  if (existing) return jsonError("You have already referred this candidate.", 409);

  const referral = await ATSReferral.create({
    employee: userId,
    candidate: body.candidateId,
    status: "pending",
    referralBonusEligible: Boolean(body.referralBonusEligible),
    company: user.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "submit-referral",
    entityType: "ATSReferral",
    entityId: referral._id,
    metadata: { candidateId: body.candidateId },
    company: user.company,
  });

  const hrUsers = await User.find({ company: user.company, role: "human-resource" });
  for (const hr of hrUsers) {
    emitToUser(String(hr._id), "notification:new", {
      message: `${user.name} referred a candidate.`,
    });
  }

  const populated = await ATSReferral.findById(referral._id)
    .populate("employee", "name email")
    .populate("candidate", "firstName lastName email");

  return NextResponse.json({ referral: serializeDocs([populated!])[0] }, { status: 201 });
}
