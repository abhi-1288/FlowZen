import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid pass id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("name role company companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const pass = await VisitorPass.findOne({ _id: id, company: actor.company });
  if (!pass) return jsonError("Visitor pass not found.", 404);
  if (pass.verificationStatus !== "pending-verification") return jsonError("This pass is not pending verification.", 400);

  // Only the authorizer (the person who shared the feature) or an admin/HR may verify.
  const isAdminHr = ["admin", "human-resource"].includes(String(actor.role));
  const isAuthorizer = (pass as any).authorizer && String((pass as any).authorizer) === userId;
  if (!isAdminHr && !isAuthorizer) return jsonError("Forbidden.", 403);
  if (String(pass.submittedBy) === userId) return jsonError("You cannot verify your own submission.", 403);

  pass.verificationStatus = "verified";
  (pass as any).verifiedBy = userId;
  (pass as any).verifiedAt = new Date();
  await pass.save();

  // Now notify admins for final approval.
  const admins = await User.find({ company: actor.company, role: { $in: ["admin", "human-resource"] } }).select("_id").lean();
  for (const admin of admins) {
    await Notification.create({
      user: (admin as any)._id,
      company: actor.company,
      type: "approval",
      title: "Visitor Pass Pending Approval",
      message: `${actor.name ?? "Approver"} verified a visitor pass for ${pass.visitorName}. Awaiting final approval.`,
      link: "/profile/visitors",
    });
    emitNotification(String((admin as any)._id));
  }

  return NextResponse.json({ pass: { ...pass.toObject(), id: String(pass._id) } });
}
