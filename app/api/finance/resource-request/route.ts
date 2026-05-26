import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { ResourceRequest } from "@/models/ResourceRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const isFinance = ["finance", "admin", "human-resource"].includes(String(actor.role));
  const filter: any = { company: actor.company };
  if (!isFinance) filter.requester = userId;

  const requests = await ResourceRequest.find(filter)
    .populate("requester", "name email role")
    .populate("decidedBy", "name")
    .sort({ createdAt: -1 });

  return NextResponse.json({ requests: serializeDocs(requests as any) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("name role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const body = await request.json();
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) return jsonError("At least one item is required.", 400);
  for (const item of items) {
    if (!String(item.name ?? "").trim()) return jsonError("Each item must have a name.", 400);
    if (Number(item.quantity ?? 0) < 1) return jsonError("Each item must have a quantity of at least 1.", 400);
  }

  const notes = String(body.notes ?? "").trim();

  const resourceRequest = await ResourceRequest.create({
    company: actor.company,
    requester: userId,
    items: items.map((i: any) => ({ name: String(i.name).trim(), quantity: Number(i.quantity), reason: String(i.reason ?? "").trim() })),
    notes,
  });

  const financeUsers = await User.find({ company: actor.company, role: "finance", companyStatus: "approved" }).select("_id");
  const itemSummary = items.map((i: any) => `${i.quantity} x ${i.name}`).join(", ");
  await Notification.insertMany(
    financeUsers.map((u) => ({
      user: u._id,
      company: actor.company,
      type: "approval",
      title: "Resource purchase request",
      message: `${actor.name ?? "A user"} requested: ${itemSummary}.`,
    }))
  );
  financeUsers.forEach((u) => emitNotification(String(u._id)));

  return NextResponse.json({ request: resourceRequest }, { status: 201 });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("name role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const body = await request.json();
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  const rejectionReason = String(body.rejectionReason ?? "").trim();

  if (!id || !["approved", "rejected"].includes(status)) return jsonError("Invalid request.", 400);
  if (status === "rejected" && !rejectionReason) return jsonError("A rejection reason is required.", 400);

  const existing = await ResourceRequest.findOne({ _id: id, company: actor.company }).populate("requester", "name");
  if (!existing) return jsonError("Resource request not found.", 404);
  if (existing.status !== "pending") return jsonError("Request already processed.", 409);

  const isFinance = ["finance", "admin"].includes(String(actor.role));
  if (!isFinance) return jsonError("Only finance and admin can process requests.", 403);

  const update: any = { status, decidedBy: userId, decidedAt: new Date() };
  if (status === "rejected") update.rejectionReason = rejectionReason;

  const updated = await ResourceRequest.findOneAndUpdate({ _id: id }, { $set: update }, { new: true });

  const requesterName = String((existing.requester as any)?.name ?? "User");
  const itemSummary = existing.items.map((i: any) => `${i.quantity} x ${i.name}`).join(", ");

  await Notification.create({
    user: existing.requester,
    company: actor.company,
    type: "info",
    title: status === "approved" ? "Resource request approved" : "Resource request rejected",
    message: status === "approved"
      ? `Your request for ${itemSummary} has been approved by ${actor.name ?? "finance"}.`
      : `Your request for ${itemSummary} was rejected by ${actor.name ?? "finance"}: ${rejectionReason}`,
  });
  emitNotification(String(existing.requester));

  return NextResponse.json({ request: updated });
}
