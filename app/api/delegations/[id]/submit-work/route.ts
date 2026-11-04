import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { FeatureDelegation } from "@/models/FeatureDelegation";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

/**
 * Recipient submits the completed work of a shared feature so the original
 * feature owner can approve and publish it. Only the recipient can submit,
 * the delegation must still be active, and a note describing the work is
 * required so the approver knows what to review.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const row: any = await FeatureDelegation.findOne({ _id: id, recipient: userId }).select("+review");
  if (!row) return jsonError("Delegation not found.", 404);
  if (row.status !== "active" || new Date(row.expiresAt) < new Date()) {
    return jsonError("This delegation is no longer active, so work can no longer be submitted.", 400);
  }

  const body = await request.json().catch(() => ({}));
  const note = String(body.note ?? "").trim();
  if (note.length < 5) return jsonError("Describe the completed work before sending it for approval (at least 5 characters).", 400);
  if (note.length > 2000) return jsonError("The work note must be 2,000 characters or fewer.", 400);

  row.review = {
    ...row.review,
    status: "submitted",
    submittedAt: new Date(),
    submitNote: note,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: "",
  };
  await row.save();

  const me = await User.findById(userId).select("name role");
  await Notification.create({
    user: row.authorizer,
    company: row.company,
    type: "approval",
    title: "Work submitted for approval",
    message: `${me?.name ?? "A member"} completed their work in ${row.featureName} and is waiting for your approval.`,
    link: "/profile/feature-delegation?tab=approvals",
  });
  emitNotification(String(row.authorizer), {
    title: "Work submitted for approval",
    body: `${me?.name ?? "A member"} completed their work in ${row.featureName} and is waiting for your approval.`,
    link: "/profile/feature-delegation?tab=approvals",
  });

  await recordAudit({
    action: "delegation.work_submitted",
    actionLabel: "Delegated work submitted for approval",
    company: row.company,
    actor: { id: userId, name: me?.name, role: me?.role },
    entityType: "FeatureDelegation",
    entityId: String(row._id),
    metadata: { featureKey: row.featureKey, noteLength: note.length },
  });

  return NextResponse.json({ ok: true, review: row.review });
}
