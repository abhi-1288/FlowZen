import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSReferral } from "@/models/ATSReferral";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    if (!user) return jsonError("User not found", 404);
    if (!user.company) return jsonError("No company found", 400);

    const companyId = user.company;
    const isSeniorSecurity = user.role === "security" && Boolean((user as any).isSeniorSecurity);
    const isHr = user.role === "admin" || user.role === "human-resource" || isSeniorSecurity;
    const isAdmin = user.role === "admin";

    const [jobsOpen, jobsClosed, candidatesOpen, candidatesClosed, interviewsOpen, interviewsClosed, offersOpen, offersClosed, referralsOpen, referralsClosed] = await Promise.all([
      ATSJob.countDocuments({ company: companyId, status: "open" }),
      ATSJob.countDocuments({ company: companyId, status: "closed" }),
      ATSCandidate.countDocuments({
        company: companyId,
        ...(isHr ? {} : { "assignedTeam.user": userId, "assignedTeam.status": { $ne: "completed" } }),
        stage: { $nin: ["joined", "rejected"] },
      }),
      ATSCandidate.countDocuments({
        company: companyId,
        ...(isHr ? {} : { "assignedTeam.user": userId, "assignedTeam.status": { $ne: "completed" } }),
        stage: { $in: ["joined", "rejected"] },
      }),
      ATSInterview.countDocuments({ company: companyId, status: "scheduled" }),
      ATSInterview.countDocuments({ company: companyId, status: { $in: ["completed", "cancelled", "rescheduled"] } }),
      ATSOffer.countDocuments({ company: companyId, status: { $in: ["draft", "sent"] } }),
      ATSOffer.countDocuments({ company: companyId, status: { $in: ["accepted", "rejected"] } }),
      ATSReferral.countDocuments({ company: companyId, status: { $in: ["pending", "reviewed"] } }),
      ATSReferral.countDocuments({ company: companyId, status: { $in: ["hired", "rejected"] } }),
    ]);

    const myRequestCount = await ATSJob.countDocuments({
      company: companyId,
      "workflow.requestedBy": userId,
      "workflow.status": { $nin: ["published"] },
    });

    const otherRequestCount = isHr || isAdmin
      ? await ATSJob.countDocuments({
          company: companyId,
          "workflow.requestedBy": { $ne: userId },
          "workflow.status": { $nin: ["published"] },
        })
      : 0;

    const pendingTasks = isHr
      ? await ATSJob.countDocuments({
          company: companyId,
          "workflow.assignedHR": userId,
          "workflow.status": { $in: ["requested", "drafting", "salary-approved"] },
        })
      : isAdmin
        ? await ATSJob.countDocuments({
            company: companyId,
            "workflow.status": { $in: ["salary-pending", "draft-ready"] },
          })
        : 0;

    return NextResponse.json({
      jobsOpen, jobsClosed,
      candidatesOpen, candidatesClosed,
      interviewsOpen, interviewsClosed,
      offersOpen, offersClosed,
      referralsOpen, referralsClosed,
      pendingTasks,
      myRequestCount,
      otherRequestCount,
    });
  } catch (err: any) {
    return jsonError(err.message || "Failed to fetch sidebar counts", 500);
  }
}
