import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select("name company companyStatus companyIdentityCode role");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to request a unique identity.", 403);
  }
  if (String(user.companyIdentityCode ?? "").trim()) {
    return NextResponse.json({ ok: true, status: "issued", code: user.companyIdentityCode });
  }

  const otherHr = await User.findOne({
    _id: { $ne: userId },
    company: user.company,
    role: "human-resource",
    companyStatus: "approved",
  }).select("_id");
  const admin =
    String(user.role ?? "") === "human-resource"
      ? await User.findOne({
          _id: { $ne: userId },
          company: user.company,
          role: "admin",
          companyStatus: "approved",
        }).select("_id")
      : null;
  const approverId = otherHr ? String(otherHr._id) : admin ? String(admin._id) : "";
  if (!approverId) {
    return jsonError(
      String(user.role ?? "") === "human-resource"
        ? "No other HR or approved admin is available for this company."
        : "No approved HR is available for this company.",
      404,
    );
  }

  const request = await JoinRequest.findOneAndUpdate(
    {
      requester: userId,
      company: user.company,
      kind: "identity-code",
      status: "pending",
    },
    {
      $set: { approver: approverId },
      $setOnInsert: {
        requester: userId,
        company: user.company,
        kind: "identity-code",
      },
    },
    { new: true, upsert: true },
  );

  await Notification.create({
    user: approverId,
    company: user.company,
    type: "approval",
    title: "Unique identity request",
    message: `${user.name} requested a company unique identity code.`,
  });
  emitNotification(String(approverId));

  return NextResponse.json({ ok: true, status: "requested", request: serializeDoc(request) });
}
