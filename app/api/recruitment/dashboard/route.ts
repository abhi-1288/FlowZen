import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
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

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const [openPositions, totalCandidates, interviewsThisWeek, offersSent, offersAccepted, candidatesByStage, candidatesBySource, totalJobs, draftJobs, closedJobs, candidatesThisMonth, interviewsThisMonth, offersThisMonth, upcomingInterviews, recentActivity, monthlyTrends] =
    await Promise.all([
      ATSJob.countDocuments({ company: companyId, status: "open" }),
      ATSCandidate.countDocuments({ company: companyId }),
      ATSInterview.countDocuments({
        company: companyId,
        scheduledAt: { $gte: startOfWeek, $lt: endOfWeek },
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
      ATSJob.countDocuments({ company: companyId }),
      ATSJob.countDocuments({ company: companyId, status: "draft" }),
      ATSJob.countDocuments({ company: companyId, status: "closed" }),
      ATSCandidate.countDocuments({ company: companyId, createdAt: { $gte: startOfMonth } }),
      ATSInterview.countDocuments({ company: companyId, createdAt: { $gte: startOfMonth } }),
      ATSOffer.countDocuments({ company: companyId, createdAt: { $gte: startOfMonth } }),
      ATSInterview.find({ company: companyId, scheduledAt: { $gte: now } })
        .sort({ scheduledAt: 1 })
        .limit(5)
        .populate("candidate", "firstName lastName")
        .populate("job", "title")
        .lean(),
      ATSTimeline.find({ company: companyId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("candidate", "firstName lastName")
        .lean(),
      ATSCandidate.aggregate([
        { $match: { company: companyId } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 12 },
      ]),
    ]);

  const stageOrder = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];
  const stageMap = new Map<string, number>(candidatesByStage.map((s: any) => [s._id, s.count as number]));
  const hiringFunnel = stageOrder.map((stage) => ({ stage, count: stageMap.get(stage) || 0 }));

  const conversionFunnel: { from: string; to: string; fromCount: number; toCount: number; conversionRate: number; dropOffRate: number }[] = [];
  const funnelStages = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined"];
  for (let i = 0; i < funnelStages.length - 1; i++) {
    const from = funnelStages[i];
    const to = funnelStages[i + 1];
    const fromCount: number = stageMap.get(from) || 0;
    const toCount: number = stageMap.get(to) || 0;
    const conversionRate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
    conversionFunnel.push({
      from, to,
      fromCount, toCount,
      conversionRate,
      dropOffRate: 100 - conversionRate,
    });
  }

  const sourcePerformance = candidatesBySource.map((s: any) => ({ source: s._id, count: s.count }));

  const formattedUpcoming = upcomingInterviews.map((i: any) => ({
    id: i._id.toString(),
    candidate: { firstName: i.candidate?.firstName ?? "", lastName: i.candidate?.lastName ?? "" },
    job: { title: i.job?.title ?? "" },
    scheduledAt: i.scheduledAt.toISOString(),
    roundType: i.roundType,
  }));

  const formattedActivity = recentActivity.map((a: any) => ({
    id: a._id.toString(),
    action: a.action,
    candidate: { firstName: a.candidate?.firstName ?? "", lastName: a.candidate?.lastName ?? "" },
    createdAt: a.createdAt.toISOString(),
  }));

  const trendsMap = new Map<string, number>();
  monthlyTrends.forEach((t: any) => {
    trendsMap.set(`${t._id.year}-${t._id.month}`, t.count ?? 0);
  });
  const fullTrends: { month: number; year: number; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    fullTrends.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      count: trendsMap.get(key) ?? 0,
    });
  }

  const candidatesPerOpening = openPositions > 0 ? Math.round((totalCandidates / openPositions) * 10) / 10 : 0;

  return NextResponse.json({
    openPositions,
    totalCandidates,
    interviewsThisWeek,
    offersSent,
    offersAccepted,
    hiringFunnel,
    conversionFunnel,
    sourcePerformance,
    userName: user.name || "there",
    totalJobs,
    draftJobs,
    closedJobs,
    candidatesThisMonth,
    interviewsThisMonth,
    offersThisMonth,
    candidatesPerOpening,
    upcomingInterviews: formattedUpcoming,
    recentActivity: formattedActivity,
    monthlyTrends: fullTrends,
  });
}
