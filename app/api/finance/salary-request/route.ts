import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { resolveEnrollingHr } from "@/lib/enrolling-hr";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select(
    "name company companyStatus role membershipHistory",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to request a salary.", 403);
  }

  const requesterRole = String(user.role ?? "");
  let approverId = "";

  if (requesterRole === "admin") {
    const otherAdmin = await User.findOne({
      _id: { $ne: userId },
      company: user.company,
      role: "admin",
      companyStatus: "approved",
    }).select("_id");
    approverId = otherAdmin ? String(otherAdmin._id) : "";
    if (!approverId) {
      const hr = await User.findOne({
        _id: { $ne: userId },
        company: user.company,
        role: "human-resource",
        companyStatus: "approved",
      }).select("_id");
      approverId = hr ? String(hr._id) : "";
    }
    if (!approverId) {
      return jsonError("No other admin or HR is available to assign your salary.", 404);
    }
  } else if (requesterRole === "human-resource") {
    const admin = await User.findOne({
      _id: { $ne: userId },
      company: user.company,
      role: "admin",
      companyStatus: "approved",
    }).select("_id");
    approverId = admin ? String(admin._id) : "";
  } else {
    const enrollingHr = await resolveEnrollingHr(user);
    approverId = enrollingHr?.id ?? "";

    if (!approverId) {
      const fallbackHr = await User.findOne({
        _id: { $ne: userId },
        company: user.company,
        role: "human-resource",
        companyStatus: "approved",
      }).select("_id");
      approverId = fallbackHr ? String(fallbackHr._id) : "";
    }
  }

  if (!approverId) {
    return jsonError(
      requesterRole === "human-resource"
        ? "No admin is available for this company."
        : requesterRole === "admin"
          ? "No other admin or HR is available for this company."
          : "No HR is available to assign your salary.",
      404,
    );
  }

  const existing = await JoinRequest.findOne({
    requester: userId,
    company: user.company,
    kind: "salary",
    status: "pending",
  });
  if (existing) {
    return NextResponse.json({ ok: true, status: "already_requested" });
  }

  const request = await JoinRequest.create({
    requester: userId,
    approver: approverId,
    company: user.company,
    kind: "salary",
    status: "pending",
  });

  await Notification.create({
    user: approverId,
    company: user.company,
    type: "approval",
    title: "Salary assignment request",
    message:
      requesterRole === "human-resource"
        ? `${user.name} (HR) requested a salary assignment — admin approval required.`
        : `${user.name} requested a salary assignment.`,
  });
  emitNotification(String(approverId));

  return NextResponse.json({ ok: true, status: "requested", requestId: String(request._id) });
}
