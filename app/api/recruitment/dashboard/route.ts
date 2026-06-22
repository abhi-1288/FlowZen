import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSOffer } from "@/models/ATSOffer";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";

const HR_ROLES = ["admin", "human-resource"];

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const companyId = user.company;

  const [openPositions, totalCandidates, interviewsThisWeek, offersSent, offersAccepted, candidatesByStage, candidatesBySource] =
    await Promise.all([
      ATSJob.countDocuments({ company: companyId, status: "open" }),
      ATSCandidate.countDocuments({ company: companyId }),
      ATSInterview.countDocuments({
        company: companyId,
        scheduledAt: {
          $gte: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())),
          $lte: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 6)),
        },
      }),
      ATSOffer.countDocuments({ company: companyId, status: "sent" }),
      ATSOffer.countDocuments({ company: companyId, status: "accepted" }),
      ATSCandidate.aggregate([
        { $match: { company: companyId } },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ]),
      ATSCandidate.aggregate([
        { $match: { company: companyId } },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
    ]);

  const stageOrder = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];
  const stageMap = new Map(candidatesByStage.map((s: any) => [s._id, s.count]));
  const hiringFunnel = stageOrder.map((stage) => ({ stage, count: stageMap.get(stage) || 0 }));

  const sourcePerformance = candidatesBySource.map((s: any) => ({ source: s._id, count: s.count }));

  return NextResponse.json({
    openPositions,
    totalCandidates,
    interviewsThisWeek,
    offersSent,
    offersAccepted,
    hiringFunnel,
    sourcePerformance,
  });
}
