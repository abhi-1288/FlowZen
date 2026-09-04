import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { Company } from "@/models/Company";
import { ITTicket } from "@/models/ITTicket";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { nextTicketNumber, pushItActivity, ticketVisibilityFilter } from "@/lib/it";
import { listApprovedItAdminUserIds } from "@/lib/join-approvers";

const CATEGORIES = new Set([
  "ACCOUNT_LOGIN",
  "ACCESS_PERMISSION",
  "HARDWARE",
  "SOFTWARE",
  "NETWORK",
  "EMAIL",
  "PRINTER_PERIPHERAL",
  "SECURITY",
  "ACCOUNT_CREATION",
  "OTHER",
]);
const PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") ?? "").toUpperCase();
  const category = String(url.searchParams.get("category") ?? "").toUpperCase();
  const priority = String(url.searchParams.get("priority") ?? "").toUpperCase();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus name");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to access IT tickets.", 403);
  }

  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const filter = await ticketVisibilityFilter({ role: String(user.role), _id: user._id }, companyId);

  if (status && status !== "ALL") filter.status = status;
  if (category && category !== "ALL") filter.category = category;
  if (priority && priority !== "ALL") filter.priority = priority;

  const tickets = await ITTicket.find(filter)
    .sort({ createdAt: -1 })
    .populate("requester", "name email")
    .populate("assignedTo", "name")
    .populate("assignedBy", "name")
    .populate("resolvedBy", "name");

  const counts = await ITTicket.aggregate([
    { $match: { company: companyId, status: { $ne: "CANCELLED" } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  return NextResponse.json({
    tickets: tickets.map(serializeDoc),
    counts: counts.reduce((acc: Record<string, number>, item: { _id: string; count: number }) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    canAssign: String(user.role) === "it-admin" || String(user.role) === "admin" || String(user.role) === "human-resource",
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const category = String(body.category ?? "OTHER").toUpperCase();
  const priority = String(body.priority ?? "MEDIUM").toUpperCase();
  const department = String(body.department ?? "").trim();

  if (!title) return jsonError("Title is required.");
  if (title.length > 200) return jsonError("Title must be 200 characters or fewer.");
  if (!description) return jsonError("Description is required.");
  if (!CATEGORIES.has(category)) return jsonError("Invalid category.");
  if (!PRIORITIES.has(priority)) return jsonError("Invalid priority.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus name email team activeTeams department customRole",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to raise IT tickets.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const ticketNumber = await nextTicketNumber(companyId);

  const ticket = await ITTicket.create({
    ticketNumber,
    title,
    description,
    category,
    priority,
    status: "PENDING",
    requester: userId,
    department,
    manager: (user as any).manager ?? null,
    company: companyId,
    activity: [],
  });
  pushItActivity(ticket, { _id: user._id }, "Ticket created", `Ticket ${ticketNumber} created by ${user.name}`);

  // Notify IT_ADMINs (fall back to all IT admins in company).
  const itAdminIds = await listApprovedItAdminUserIds(companyId);
  const notifications = itAdminIds.map((itAdminId) => ({
    user: itAdminId,
    company: companyId,
    type: "info" as const,
    title: "New IT ticket",
    message: `${user.name} raised ${ticketNumber}: ${title}${priority === "URGENT" ? " [URGENT]" : ""}`,
  }));
  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
    notifications.forEach((n) => emitNotification(String(n.user)));
  }

  await ticket.save();
  return NextResponse.json({ ticket: serializeDoc(ticket) }, { status: 201 });
}
