import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ITProvisioningRequest } from "@/models/ITProvisioningRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { listApprovedItAdminUserIds } from "@/lib/join-approvers";
import { canManageIt, pushProvisioningActivity } from "@/lib/it";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select(
    "role company companyStatus name isSeniorSecurity",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to view provisioning requests.", 403);
  }
  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;
  const role = String(actor.role);

  // Visibility: IT staff (admin/hr), and HR (they create the requests).
  const isHr = role === "human-resource" || role === "admin";
  const isIt = canManageIt(role, Boolean(actor.isSeniorSecurity)) || role === "it-administration";
  if (!isHr && !isIt) {
    return jsonError("You do not have permission to view provisioning requests.", 403);
  }

  const filter: Record<string, unknown> = { company: companyId };
  if (role === "human-resource") {
    filter.createdBy = userId;
  }

  const requests = await ITProvisioningRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("employee", "name email")
    .populate("createdBy", "name")
    .populate("manager", "name");

  return NextResponse.json({ requests: requests.map(serializeDoc) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const employeeId = String(body.employeeId ?? "").trim();
  if (!employeeId) return jsonError("employeeId is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select(
    "role company companyStatus name isSeniorSecurity",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to create provisioning requests.", 403);
  }
  const role = String(actor.role);
  const isHr = role === "human-resource" || role === "admin";
  if (!isHr) {
    return jsonError("Only HR can initiate provisioning requests.", 403);
  }
  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;

  // The employee should already be an approved member of the company (converted candidate).
  const employee = await User.findOne({
    _id: employeeId,
    company: companyId,
    companyStatus: "approved",
  }).select("name email role customRole team managerName");
  if (!employee) return jsonError("Employee not found or not an approved company member.", 404);

  const requestedRole = String(body.requestedRole ?? String(employee.role ?? "employee")).trim();
  const requiredAccess = String(body.requiredAccess ?? "").trim();
  const designation = String(body.designation ?? String((employee as any).customRole ?? "")).trim();
  const managerId = String(body.managerId ?? "").trim() || (employee as any).manager || null;
  const email = String(body.email ?? String(employee.email ?? "")).trim().toLowerCase();

  const existingPending = await ITProvisioningRequest.findOne({
    employee: employeeId,
    company: companyId,
    status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
  });
  if (existingPending) {
    return jsonError("An active provisioning request already exists for this employee.", 409);
  }

  const provisioning = await ITProvisioningRequest.create({
    employee: employeeId,
    employeeName: employee.name,
    department: String((employee as any).department ?? ""),
    designation,
    email,
    manager: managerId || null,
    managerName: String(body.managerName ?? ""),
    requestedRole,
    requiredAccess,
    createdBy: userId,
    createdByName: actor.name,
    company: companyId,
    status: "PENDING",
  });
  pushProvisioningActivity(
    provisioning,
    { _id: actor._id },
    "Request created",
    `Provisioning request created for ${employee.name} by ${actor.name}`,
  );
  await provisioning.save();

  // Notify IT admins.
  const itAdminIds = await listApprovedItAdminUserIds(companyId);
  const notifications = itAdminIds.map((itAdminId) => ({
    user: itAdminId,
    company: companyId,
    type: "approval" as const,
    title: "IT provisioning request",
    message: `${actor.name} sent a provisioning request for ${employee.name} (${requestedRole}).`,
  }));
  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
    notifications.forEach((n) => emitNotification(String(n.user)));
  }

  return NextResponse.json({ request: serializeDoc(provisioning) }, { status: 201 });
}
