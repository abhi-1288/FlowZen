import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { User } from "@/models/User";
import { effectiveRegionLabelOf, isUserInEffectiveRegion } from "@/lib/company-regions";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  const { memberId, hrId, adminId, reason } = body as Record<string, unknown>;
  if (!isObjectId(String(memberId ?? "")) || !isObjectId(String(hrId ?? "")) || !isObjectId(String(adminId ?? ""))) {
    return jsonError("Invalid selection.", 400);
  }
  if (!String(reason ?? "").trim()) return jsonError("Reason is required.", 400);
  if (String(memberId) === String(userId)) return jsonError("You cannot target yourself.", 400);
  if (String(hrId) === String(userId)) return jsonError("HR cannot request for themselves.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [requester, member, hr, admin] = await Promise.all([
    User.findById(userId),
    User.findById(String(memberId)),
    User.findById(String(hrId)),
    User.findById(String(adminId)),
  ]);
  if (!requester || !member || !hr || !admin) return jsonError("User not found.", 404);
  if (String(hr.role) !== "human-resource" || String(admin.role) !== "admin") {
    return jsonError("Select a valid HR and admin.", 400);
  }

  const company = await (await import("@/models/Company")).Company.findById(requester.company).lean();
  const region = effectiveRegionLabelOf(company as any, requester as any);
  for (const person of [member, hr, admin]) {
    if (!isUserInEffectiveRegion(company as any, region, person as any)) {
      return jsonError("Requester, member, HR and admin must be in the same region.", 403);
    }
  }

  const created = await JoinRequest.create({
    requester: userId,
    approver: hr._id,
    company: requester.company,
    kind: "document-letter",
    metadata: {
      letterType: "termination",
      targetUser: member._id,
      reason: String(reason).trim(),
      signatories: [
        { user: hr._id, role: "hr", status: "pending" },
        { user: admin._id, role: "admin", status: "pending" },
      ],
    },
  });

  await Notification.create({
    user: hr._id,
    company: requester.company,
    type: "approval",
    title: "Termination letter e-sign requested",
    message: `${String(requester.name ?? "A member")} requested a termination letter for ${String(member.name ?? "a member")}.`,
  });
  emitNotification(String(hr._id));

  return NextResponse.json({ id: String(created._id) });
}
