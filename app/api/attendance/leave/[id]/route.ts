import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { LeaveRequest } from "@/models/LeaveRequest";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { emitToUser } from "@/lib/socket-emit";
import { effectiveRegionLabelOf, isUserInEffectiveRegion, type OfficeAddressLike } from "@/lib/company-regions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const { action, reason: rejectionReason, assignedAdmin } = await req.json();
    if (!["approve", "reject", "revoke"].includes(action)) return jsonError("Invalid action.");

    await connectDb();
    const approver = await User.findById(userId);
    const leave = await LeaveRequest.findById(id).populate("requester");
    if (!leave) return jsonError("Request not found.");

    // Cross-tenant guard: the actor must belong to the leave's company. The
    // request is looked up by id alone, so without this any admin in any
    // company could approve another company's request.
    if (String(approver?.company ?? "") !== String(leave.company)) {
      return jsonError("Request not found.", 404);
    }

    const approverRole = String(approver?.role ?? "");
    const requesterId = typeof leave.requester === "object" ? leave.requester._id : leave.requester;
    const isRequester = String(requesterId) === String(userId);

    if (action === "revoke") {
      if (!isRequester) return jsonError("Only the requester can revoke this request.", 403);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (new Date(leave.startDate) <= now) return jsonError("Cannot revoke a request that has already started.", 400);
      if (leave.status === "rejected") return jsonError("Cannot revoke a rejected request.", 400);
      leave.status = "rejected";
      leave.rejectionReason = "Revoked by requester.";
      await leave.save();

      await Notification.create({
        user: requesterId,
        title: "Leave Revoked",
        body: "Your leave request has been revoked successfully.",
        link: "/profile?tab=attendance",
      });
      emitToUser(String(requesterId), "notification:new", {});
      return NextResponse.json({ leave });
    }

    if (isRequester) return jsonError("You cannot approve your own leave request.", 403);

    if (leave.currentStep === "admin") {
      if (approverRole !== "admin") {
        return jsonError("Only admins can approve the final leave step.", 403);
      }
      // Regional admins may only approve leave for requesters in their own
      // region. The company owner may approve any.
      const companyDoc = (await Company.findById(leave.company)
        .select("owner addresses address")
        .lean()) as {
        owner?: unknown;
        addresses?: OfficeAddressLike[] | null;
        address?: string | null;
      } | null;
      const ownerId = companyDoc?.owner ?? null;
      const isOwner = ownerId != null && String(ownerId) === String(userId);
      if (!isOwner) {
        const adminRegion = effectiveRegionLabelOf(companyDoc, approver);
        if (adminRegion && !isUserInEffectiveRegion(companyDoc, adminRegion, leave.requester)) {
          return jsonError(`This request is outside your region (${adminRegion}).`, 403);
        }
      }
    } else {
      if (approverRole !== "human-resource" && approverRole !== "admin") {
        return jsonError("Only HR can approve this leave step.", 403);
      }
    }

    if (action === "reject") {
      leave.status = "rejected";
      leave.rejectionReason = rejectionReason || "No reason provided.";
    } else {
      if (leave.currentStep === "hr" && approverRole === "human-resource") {
        leave.status = "hr-approved";
        leave.hrApprover = approver?._id;
        leave.currentStep = "admin";
        if (assignedAdmin) {
          leave.assignedAdmin = assignedAdmin;
        }
      } else {
        leave.status = "approved";
        leave.adminApprover = approver?._id;
      }
    }

    await leave.save();

    if (leave.status === "hr-approved") {
      if (leave.assignedAdmin) {
        await Notification.create({
          user: leave.assignedAdmin,
          title: "Paid Leave Final Approval",
          body: `A paid leave request from ${leave.requester.name} needs your final approval. (Assigned to you)`,
          link: "/profile?tab=attendance"
        });
        emitToUser(String(leave.assignedAdmin), "notification:new", {});
      } else {
        const admins = await User.find({ role: "admin", company: leave.company });
        for (const admin of admins) {
          await Notification.create({
            user: admin._id,
            title: "Paid Leave Final Approval",
            body: `A paid leave request from ${leave.requester.name} needs your final approval.`,
            link: "/profile?tab=attendance"
          });
          emitToUser(String(admin._id), "notification:new", {});
        }
      }
    } else {
      const requesterId = leave.requester._id || leave.requester;
      const statusTitle = leave.status.charAt(0).toUpperCase() + leave.status.slice(1);
      const rejectionNote = leave.status === "rejected" ? ` Reason: ${leave.rejectionReason}` : "";

      await Notification.create({
        user: requesterId,
        title: `Leave ${statusTitle}`,
        body: `Your leave request from ${new Date(leave.startDate).toLocaleDateString()} has been ${leave.status}.${rejectionNote}`,
        link: "/profile?tab=attendance"
      });
      emitToUser(String(requesterId), "notification:new", {});
    }

    return NextResponse.json({ leave });
  } catch (err: any) {
    console.error("Leave approval error:", err);
    return jsonError(err.message || "Failed to process leave request", 500);
  }
}
