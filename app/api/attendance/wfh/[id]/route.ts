import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { WfhRequest } from "@/models/WfhRequest";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitToUser } from "@/lib/socket-emit";
import { resolveEnrollingHr } from "@/lib/enrolling-hr";
import { findApprovedHrUserId } from "@/lib/join-approvers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const { action, reason: rejectionReason } = await req.json();
    if (!["approve", "reject"].includes(action)) return jsonError("Invalid action.");

    await connectDb();
    const approver = await User.findById(userId);
    const wfh = await WfhRequest.findById(id).populate("requester");
    if (!wfh) return jsonError("Request not found.");

    const approverRole = String(approver?.role ?? "");
    const requesterId =
      typeof wfh.requester === "object" ? (wfh.requester as any)._id : wfh.requester;
    const isRequester = String(requesterId) === String(userId);
    if (isRequester) return jsonError("You cannot approve your own WFH request.", 403);

    if (action === "reject") {
      wfh.status = "rejected";
      wfh.rejectionReason = rejectionReason || "No reason provided.";
      await wfh.save();

      const fromDate = new Date(wfh.startDate).toLocaleDateString();
      const toDate = new Date(wfh.endDate).toLocaleDateString();
      const dur = wfh.duration;

      await Notification.create({
        user: requesterId,
        title: "WFH Request Rejected",
        body: `Your WFH request from ${fromDate} to ${toDate} (${dur} day${dur === 1 ? "" : "s"}) has been rejected. Reason: ${wfh.rejectionReason}`,
        link: "/profile?tab=attendance",
      });
      emitToUser(String(requesterId), "notification:new", {});
      return NextResponse.json({ wfh });
    }

    // Approve logic
    const requester = typeof wfh.requester === "object" ? (wfh.requester as any) : null;
    const companyId = String(wfh.company);

    if (wfh.currentStep === "manager") {
      // Manager approves → send to HR
      if (approverRole !== "project-manager" && approverRole !== "qa-tester" && approverRole !== "admin") {
        return jsonError("Only managers, testers, or admins can approve this step.", 403);
      }
      wfh.status = "manager-approved";
      wfh.managerApprover = approver?._id;
      wfh.currentStep = "hr";
      await wfh.save();

      const enrollingHr = await resolveEnrollingHr(requester || { _id: requesterId, company: wfh.company });
      if (enrollingHr) {
        await Notification.create({
          user: enrollingHr.id,
          title: "WFH Request - HR Approval Needed",
          body: `A WFH request from ${requester?.name || "User"} needs your approval.`,
          link: "/profile?tab=attendance",
        });
        emitToUser(enrollingHr.id, "notification:new", {});
      } else {
        const hrId = await findApprovedHrUserId(companyId as any);
        if (hrId) {
          await Notification.create({
            user: hrId,
            title: "WFH Request - HR Approval Needed",
            body: `A WFH request from ${requester?.name || "User"} needs your approval.`,
            link: "/profile?tab=attendance",
          });
          emitToUser(hrId, "notification:new", {});
        } else {
          const admins = await User.find({ role: "admin", company: wfh.company, companyStatus: "approved" });
          for (const admin of admins) {
            await Notification.create({
              user: admin._id,
              title: "WFH Request - Admin Approval Needed",
              body: `A WFH request from ${requester?.name || "User"} needs final approval (no HR available).`,
              link: "/profile?tab=attendance",
            });
            emitToUser(String(admin._id), "notification:new", {});
          }
          wfh.currentStep = "admin";
          await wfh.save();
        }
      }
    } else if (wfh.currentStep === "hr") {
      // HR approves → send to admin
      if (approverRole !== "human-resource" && approverRole !== "admin") {
        return jsonError("Only HR or admin can approve this step.", 403);
      }
      wfh.status = "hr-approved";
      wfh.hrApprover = approver?._id;
      wfh.currentStep = "admin";
      await wfh.save();

      const admins = await User.find({ role: "admin", company: wfh.company, companyStatus: "approved" });
      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          title: "WFH Request - Admin Final Approval",
          body: `A WFH request from ${requester?.name || "User"} needs your final approval.`,
          link: "/profile?tab=attendance",
        });
        emitToUser(String(admin._id), "notification:new", {});
      }
    } else if (wfh.currentStep === "admin") {
      // Admin final approval
      if (approverRole !== "admin") {
        return jsonError("Only admins can give final approval.", 403);
      }
      wfh.status = "approved";
      wfh.adminApprover = approver?._id;
      await wfh.save();

      const fromDate = new Date(wfh.startDate).toLocaleDateString();
      const toDate = new Date(wfh.endDate).toLocaleDateString();
      const dur = wfh.duration;
      await Notification.create({
        user: requesterId,
        title: "WFH Request Approved",
        body: `Your WFH request from ${fromDate} to ${toDate} (${dur} day${dur === 1 ? "" : "s"}) has been approved.`,
        link: "/profile?tab=attendance",
      });
      emitToUser(String(requesterId), "notification:new", {});
    }

    return NextResponse.json({ wfh });
  } catch (err: any) {
    console.error("WFH approval error:", err);
    return jsonError(err.message || "Failed to process WFH request", 500);
  }
}
