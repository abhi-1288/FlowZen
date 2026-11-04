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
 * The original feature owner reviews submitted work: approve (publishes it)
 * or request changes so the member can redo and resubmit. Only the authorizer
 * of the delegation can review, and a note is required when asking for
 * changes so the member knows what to fix.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const row: any = await FeatureDelegation.findOne({ _id: id, authorizer: userId }).select("+review");
  if (!row) return jsonError("Delegation not found.", 404);

  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision ?? "");
  if (decision !== "approved" && decision !== "changes-requested") {
    return jsonError("Decision must be 'approved' or 'changes-requested'.", 400);
  }

  const note = String(body.note ?? "").trim();
  if (decision === "changes-requested" && note.length < 5) {
    return jsonError("Tell the member what to change before requesting changes (at least 5 characters).", 400);
  }
  if (note.length > 2000) return jsonError("The review note must be 2,000 characters or fewer.", 400);

  row.review = {
    ...row.review,
    status: decision,
    submittedAt: row.review?.submittedAt ?? null,
    reviewedAt: new Date(),
    reviewedBy: userId,
    reviewNote: note,
  };
  await row.save();

  const me = await User.findById(userId).select("name role");
  const approved = decision === "approved";
  await Notification.create({
    user: row.recipient,
    company: row.company,
    type: approved ? "approval" : "system",
    title: approved ? "Work approved and published" : "Changes requested on your work",
    message: approved
      ? `${me?.name ?? "The approver"} approved your work in ${row.featureName}. It is now published.`
      : `${me?.name ?? "The approver"} requested changes in ${row.featureName}: ${note}`,
    link: "/profile/feature-delegation?view=shared",
  });
  emitNotification(String(row.recipient), {
    title: approved ? "Work approved and published" : "Changes requested on your work",
    body: approved
      ? `${me?.name ?? "The approver"} approved your work in ${row.featureName}. It is now published.`
      : `${me?.name ?? "The approver"} requested changes in ${row.featureName}: ${note}`,
    link: "/profile/feature-delegation?view=shared",
  });

  await recordAudit({
    action: "delegation.work_reviewed",
    actionLabel: approved ? "Delegated work approved and published" : "Changes requested on delegated work",
    company: row.company,
    actor: { id: userId, name: me?.name, role: me?.role },
    entityType: "FeatureDelegation",
    entityId: String(row._id),
    result: approved ? "success" : undefined,
    metadata: { featureKey: row.featureKey, decision, noteLength: note.length },
  });

  return NextResponse.json({ ok: true, review: row.review });
}
