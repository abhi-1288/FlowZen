import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { departmentRegionHeads, resolveDepartmentRouting } from "@/lib/department-routing";

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

  const user = await User.findById(userId).select("company");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company) return jsonError("You are not assigned to a company.", 403);

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  try {
    const routing = await resolveDepartmentRouting(companyId, userId);
    return NextResponse.json(routing);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load approvers.", 400);
  }
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const department = String(body.department ?? "").trim();
  const reason = String(body.reason ?? "").trim();

  if (!department) return jsonError("Department name is required.", 400);
  if (department.length > 100) return jsonError("Department name must be 100 characters or fewer.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (!user.company) return jsonError("You are not assigned to a company.", 403);

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  let routing;
  try {
    routing = await resolveDepartmentRouting(companyId, userId);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to resolve approvers.", 400);
  }

  if (routing.mode === "direct") {
    // Admin heads create directly. Only the department label is stamped — the
    // requester assigns/creates the team themselves afterwards. The approved
    // request is kept as the record of who heads the department and its region.
    await User.updateOne({ _id: userId }, { $set: { department } });
    await JoinRequest.create({
      requester: userId,
      approver: userId,
      company: companyId,
      team: user.team ?? null,
      kind: "department",
      status: "approved",
      metadata: {
        department,
        reason,
        requesterName: user.name,
        region: routing.region,
        adminHeadId: userId,
        skipHrStage: true,
        departmentHeadId: String(userId),
        approvedAt: new Date().toISOString(),
      },
    });
    await Notification.create({
      user: userId,
      company: companyId,
      type: "approval",
      title: "Department created",
      message: `The "${department}" department was created. Assign a team for it from Onboarding.`,
      link: "/profile/onboarding",
    });
    emitNotification(userId);
    return NextResponse.json({ status: "created", department }, { status: 201 });
  }

  const existing = await JoinRequest.findOne({
    requester: userId,
    company: companyId,
    kind: "department",
    status: "pending",
  });
  if (existing) return jsonError("You already have a pending department request.", 409);

  const approverId = String(body.approverId ?? "").trim();
  if (!approverId) return jsonError("Please select an approver.", 400);
  const selected = routing.options.find((option) => option.id === approverId);
  if (!selected) return jsonError("The selected approver is not available for your region.", 400);

  // Two-stage chain: an HR head's approval forwards the request to the region's
  // admin head for final approval. Requests that start with an admin head
  // (`skipHrStage`) already have the only approval they need.
  const hrFirst = String(selected.role) === "human-resource";
  const approverRegion = selected.region || routing.region;
  const { adminHeadId } = await departmentRegionHeads(companyId, approverRegion);
  if (hrFirst && !adminHeadId) {
    return jsonError(
      "No admin head is assigned to this region. Ask an admin to assign one before requesting a department.",
      409,
    );
  }

  const joinRequest = await JoinRequest.create({
    requester: userId,
    approver: approverId,
    company: companyId,
    team: user.team ?? null,
    kind: "department",
    status: "pending",
    metadata: {
      department,
      reason,
      requesterName: user.name,
      approverName: selected.name,
      region: approverRegion,
      hrHeadId: hrFirst ? approverId : "",
      adminHeadId,
      skipHrStage: !hrFirst,
    },
  });

  await Notification.create({
    user: approverId,
    company: companyId,
    type: "approval",
    title: "Department approval required",
    message: hrFirst
      ? `${user.name} has requested a new department "${department}". Approve it to forward the request to the region's admin head.`
      : `${user.name} has requested a new department "${department}".`,
    link: "/profile/approvals",
  });
  emitNotification(approverId);

  return NextResponse.json({ requestId: String(joinRequest._id), status: "submitted" }, { status: 201 });
}
