import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { LeaveRequest } from "@/models/LeaveRequest";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Notification } from "@/models/Notification";
import { emitToUser } from "@/lib/socket-emit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const { action, reason: rejectionReason } = await req.json();
    if (!["approve", "reject"].includes(action)) return jsonError("Invalid action.");

    await connectDb();
    const approver = await User.findById(userId);
    const leave = await LeaveRequest.findById(id).populate("requester");
    if (!leave) return jsonError("Request not found.");

    // Validation
    if (leave.currentStep === "admin") {
      if (approver?.role !== "admin") return jsonError("Only admins can approve this step.");
    } else if (leave.currentStep === "manager") {
      const isManager = approver?.role === "project-manager" || approver?.role === "qa-tester";
      if (!isManager) return jsonError("Only managers/testers can approve this step.");
      
      // Check if they are actually the manager for this user
      const team = await Team.findOne({ employees: leave.requester._id, manager: userId });
      if (!team && approver?.role !== "admin") {
        return jsonError(`Authorization failed: You are not the manager of ${leave.requester.name}'s team.`);
      }
    }

    if (action === "reject") {
      leave.status = "rejected";
      leave.rejectionReason = rejectionReason || "No reason provided.";
    } else {
      if (leave.currentStep === "manager" && leave.duration > 5) {
        leave.status = "manager-approved";
        leave.currentStep = "admin";
      } else {
        leave.status = "approved";
      }
    }

    await leave.save();

    if (leave.status === "manager-approved") {
      // Notify all admins
      const admins = await User.find({ role: "admin" });
      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          title: "Leave Escalated",
          body: `A leave request from ${leave.requester.name} needs your final approval.`,
          link: "/profile?tab=attendance"
        });
        emitToUser(String(admin._id), "notification:new", {});
      }
    } else {
      // Final status - notify requester
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
