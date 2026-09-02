import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { findApprovedAdminUserId, findApprovedHrUserId } from "@/lib/join-approvers";

const VALID_EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));

  const employmentType = String(body.employmentType ?? "").trim();
  if (!VALID_EMPLOYMENT_TYPES.includes(employmentType)) {
    return jsonError("Please choose a valid employment type.", 400);
  }
  let employmentEndDate: Date | null = null;
  if (body.employmentEndDate) {
    const parsed = new Date(String(body.employmentEndDate));
    if (!Number.isNaN(parsed.getTime())) employmentEndDate = parsed;
  }

  await connectDb();

  const user = await User.findById(userId).select("name company companyStatus role employmentType");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to request an employment type.", 403);
  }
  if (String(user.employmentType ?? "").trim()) {
    return jsonError("Your employment type is already set.", 400);
  }

  const pending = await JoinRequest.findOne({
    requester: userId,
    company: user.company,
    kind: "employment-type",
    status: { $in: ["pending", "hr-approved"] },
  });
  if (pending) {
    return NextResponse.json({ ok: true, status: "requested" });
  }

  const isRequesterHr = String(user.role) === "human-resource";
  const approverId = isRequesterHr
    ? await findApprovedAdminUserId(user.company, userId)
    : await findApprovedHrUserId(user.company, userId);

  if (!approverId) {
    return jsonError(
      isRequesterHr
        ? "No approved admin is available for this company."
        : "No approved HR is available for this company.",
      404,
    );
  }

  const joinRequest = await JoinRequest.create({
    requester: userId,
    approver: approverId,
    company: user.company,
    kind: "employment-type",
    status: "pending",
    metadata: {
      employmentType,
      employmentEndDate: employmentEndDate ? employmentEndDate.toISOString() : "",
    },
  });

  await Notification.create({
    user: approverId,
    company: user.company,
    type: "approval",
    title: "Employment type request",
    message: `${user.name} requested the employment type "${employmentType.replace(/-/g, " ")}".`,
  });
  emitNotification(String(approverId));

  return NextResponse.json({ ok: true, status: "requested", request: serializeDoc(joinRequest) });
}
