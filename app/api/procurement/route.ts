import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { Notification } from "@/models/Notification";
import { ProcurementRequest } from "@/models/ProcurementRequest";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { effectiveRegionLabelOf } from "@/lib/company-regions";
import { Company } from "@/models/Company";
import {
  formatAmount,
  isProcurementCategory,
  nextProcurementNumber,
  procurementRequestFilter,
  procurementScope,
  PROCUREMENT_IT_ROLES,
  pushProcurementActivity,
  resolveProcurementRoute,
  validateProcurementAssignee,
} from "@/lib/procurement";

const IT_ROLE_SET = new Set<string>([...PROCUREMENT_IT_ROLES]);

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus name regionLabel",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError(
      "You must be an approved company member to view purchase requests.",
      403,
    );
  }

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") ?? "").toUpperCase();
  const category = String(url.searchParams.get("category") ?? "").toLowerCase();

  // One regional boundary for the whole request, identical to how salaries are
  // scoped: the actor sees their own region's requests, falling back to the
  // whole company when the company has no regions or the region is empty.
  const scope = await procurementScope(user as any);
  const filter: Record<string, unknown> = {
    company: user.company,
    ...procurementRequestFilter(scope),
  };
  if (status && status !== "ALL") filter.status = status;
  if (category && category !== "ALL") filter.category = category;

  const requests = await ProcurementRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("requester", "name email role customRole regionLabel")
    .populate("itAssignedTo", "name email role")
    .populate("itReviewedBy", "name email role")
    .populate("financeAssignedTo", "name email role")
    .populate("expense", "requestNumber status amount currency");

  const counts = await ProcurementRequest.aggregate([
    { $match: { company: user.company, ...procurementRequestFilter(scope) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  // Only the roles that own the IT leg may act on it. `it-admin` and
  // `it-administration` are the same for procurement purposes, so unlike the
  // ticket board both get full review rights.
  const canDecide = IT_ROLE_SET.has(String(user.role));

  return NextResponse.json({
    requests: serializeDocs(requests as any),
    region: scope.region,
    regionFallback: !scope.memberIds,
    counts: counts.reduce(
      (acc: Record<string, number>, item: { _id: string; count: number }) => {
        acc[item._id] = item.count;
        return acc;
      },
      {},
    ),
    canDecide,
  });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "").trim().toLowerCase();
  const vendor = String(body.vendor ?? "").trim().slice(0, 160);
  const reason = String(body.reason ?? "").trim().slice(0, 2000);
  const currency = String(body.currency ?? "INR").trim().toUpperCase().slice(0, 8) || "INR";
  const amount = Number(body.amount ?? 0);
  const quantity = Math.max(1, Math.floor(Number(body.quantity ?? 1)));

  if (!title) return jsonError("A title is required.");
  if (title.length > 200) return jsonError("Title must be 200 characters or fewer.");
  if (!isProcurementCategory(category)) return jsonError("Invalid purchase category.");
  if (!Number.isFinite(amount) || amount < 0)
    return jsonError("Enter a valid amount.");
  if (!Number.isFinite(quantity) || quantity < 1)
    return jsonError("Enter a valid quantity.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus name email regionLabel",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError(
      "You must be an approved company member to raise a purchase request.",
      403,
    );
  }

  // Server-side routing: it-admin / it-administration buy for the company, so
  // their purchases go to finance. Everyone else is reviewed by IT first.
  const route = resolveProcurementRoute(user.role);
  const assigneeLabel = route === "it" ? "IT admin" : "finance user";
  const scope = await procurementScope(user as any);

  const assignedTo = String(body.assignedTo ?? "");
  const assigneeError = await validateProcurementAssignee({
    actor: user as any,
    scope,
    userId: assignedTo,
    route,
    label: assigneeLabel,
  });
  if (assigneeError) return jsonError(assigneeError, 400);

  const companyDoc = (await Company.findById(user.company)
    .select("addresses address")
    .lean()) as any;
  const regionLabel = effectiveRegionLabelOf(companyDoc, user as any);

  const requestNumber = await nextProcurementNumber(user.company);

  const request = await ProcurementRequest.create({
    company: user.company,
    requestNumber,
    requester: userId,
    regionLabel,
    title,
    category,
    vendor,
    reason,
    amount: Math.round(amount * 100) / 100,
    quantity,
    currency,
    // IT-staff requests are already their final destination, so they land
    // pre-assigned; everyone else's waits in the IT queue.
    status: "PENDING_IT",
    itAssignedTo: route === "it" ? assignedTo : null,
    itAssignedBy: route === "it" ? userId : null,
    itAssignedAt: route === "it" ? new Date() : null,
    financeAssignedTo: route === "finance" ? assignedTo : null,
    activity: [],
  });

  pushProcurementActivity(
    request,
    { _id: user._id, name: user.name },
    "Purchase request created",
    `${requestNumber} raised by ${user.name} for ${formatAmount(amount, currency)}${
      route === "it" ? " — awaiting IT review" : " — routed to finance"
    }`,
  );
  await request.save();

  const summary = `${requestNumber} · ${title} · ${formatAmount(amount, currency)}${
    quantity > 1 ? ` × ${quantity}` : ""
  }`;

  if (route === "it") {
    await Notification.create({
      user: assignedTo,
      company: user.company,
      type: "info",
      title: "Purchase request awaiting IT review",
      message: `${user.name} raised ${summary} in ${regionLabel || "your company"}.`,
    });
    emitNotification(assignedTo);
  } else {
    await Notification.create({
      user: assignedTo,
      company: user.company,
      type: "info",
      title: "IT purchase request assigned to you",
      message: `${user.name} raised ${summary}. IT staff purchases are actioned by finance directly.`,
    });
    emitNotification(assignedTo);
  }

  return NextResponse.json({ request: request.toObject() }, { status: 201 });
}
