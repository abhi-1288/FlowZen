import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LostCardReport } from "@/models/LostCardReport";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

const STATUS_VALUES = [
  "reported", "under-verification", "replacement-approved", "card-disabled",
  "hr-approved", "printing", "ready-for-pickup", "completed",
  "rejected", "found", "found-after-replacement",
] as const;

function serializeReport(r: Record<string, unknown>) {
  return {
    id: String(r._id),
    user: r.user,
    reportedBy: r.reportedBy,
    reportedByEmployee: r.reportedByEmployee,
    status: r.status,
    reason: r.reason,
    lastLocation: r.lastLocation,
    lostDateTime: r.lostDateTime,
    policeComplaintNumber: r.policeComplaintNumber,
    isEmergency: r.isEmergency,
    notes: r.notes,
    verifiedBy: r.verifiedBy,
    verifiedAt: r.verifiedAt,
    verificationNotes: r.verificationNotes,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt,
    cardDisabledBy: r.cardDisabledBy,
    cardDisabledAt: r.cardDisabledAt,
    disabledZones: r.disabledZones,
    hrApprovedBy: r.hrApprovedBy,
    hrApprovedAt: r.hrApprovedAt,
    newCardNumber: r.newCardNumber,
    newRfidUid: r.newRfidUid,
    issueDate: r.issueDate,
    expiryDate: r.expiryDate,
    printedBy: r.printedBy,
    printedAt: r.printedAt,
    collectedAt: r.collectedAt,
    collectedBy: r.collectedBy,
    collectionVerificationMethod: r.collectionVerificationMethod,
    assignedSecurity: r.assignedSecurity,
    expectedCompletion: r.expectedCompletion,
    assignedSeniorSecurity: r.assignedSeniorSecurity,
    assignedHR: r.assignedHR,
    seniorTicketOpened: r.seniorTicketOpened,
    seniorTicketOpenedBy: r.seniorTicketOpenedBy,
    seniorTicketOpenedAt: r.seniorTicketOpenedAt,
    assignedJuniorSecurity: r.assignedJuniorSecurity,
    juniorAcceptedAt: r.juniorAcceptedAt,
    followUpNotes: r.followUpNotes,
    juniorCompletedAt: r.juniorCompletedAt,
    oldCardFound: r.oldCardFound,
    replacementAlreadyIssued: r.replacementAlreadyIssued,
    oldCardDestroyed: r.oldCardDestroyed,
    rejectionReason: r.rejectionReason,
    rejectedBy: r.rejectedBy,
    rejectedAt: r.rejectedAt,
    timeline: r.timeline,
    reportedAt: r.reportedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

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

  const actor = await User.findById(userId).select("company role isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";
  const scope = url.searchParams.get("scope") ?? "";

  const isAdminHrSecurity = ["admin", "human-resource", "security"].includes(String(actor.role));

  if (scope === "tickets") {
    // Dashboard tickets — accessible by all authenticated users (employees see their own)
    const filter: Record<string, unknown> = { company: actor.company, seniorTicketOpened: true };
    if (!isAdminHrSecurity) {
      // Employee sees only their own tickets
      filter.user = userId;
    } else if (String(actor.role) === "human-resource") {
      // HR sees tickets assigned to them
      filter.assignedHR = userId;
    } else if (String(actor.role) === "security" && !Boolean(actor.isSeniorSecurity)) {
      // Junior security sees tickets they accepted or tickets available
      filter.$or = [
        { assignedJuniorSecurity: userId },
        { assignedJuniorSecurity: null },
      ];
    }
    // Admin and senior security see all tickets

    const reports = await LostCardReport.find(filter)
      .sort({ createdAt: -1 })
      .populate("user", "name email avatarUrl companyIdentityCode role")
      .populate("assignedSeniorSecurity", "name email role")
      .populate("assignedHR", "name email role")
      .populate("assignedJuniorSecurity", "name email role")
      .populate("followUpNotes.addedBy", "name email role")
      .lean() as Record<string, unknown>[];

    return NextResponse.json({ reports: reports.map(serializeReport) });
  }

  // Admin/HR/security-only view (security tab)
  if (!isAdminHrSecurity) return jsonError("Forbidden.", 403);

  const filter: Record<string, unknown> = { company: actor.company };
  if (status) filter.status = status;

  const reports = await LostCardReport.find(filter)
    .sort({ isEmergency: -1, reportedAt: -1 })
    .populate("user", "name email avatarUrl companyIdentityCode role")
    .populate("reportedBy", "name email role")
    .populate("verifiedBy", "name email role")
    .populate("approvedBy", "name email role")
    .populate("cardDisabledBy", "name email role")
    .populate("hrApprovedBy", "name email role")
    .populate("printedBy", "name email role")
    .populate("collectedBy", "name email role")
    .populate("assignedSecurity", "name email role")
    .populate("assignedSeniorSecurity", "name email role")
    .populate("assignedHR", "name email role")
    .populate("assignedJuniorSecurity", "name email role")
    .populate("followUpNotes.addedBy", "name email role")
    .lean() as Record<string, unknown>[];

  return NextResponse.json({
    reports: reports.map(serializeReport),
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("name role company");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);

  const isHrOrSecurity = ["admin", "human-resource", "security"].includes(String(actor.role));

  const body = await request.json();

  let targetUserId: string;
  let reportedByEmployee = false;

  if (isHrOrSecurity) {
    // HR/Security/Admin — can report for any employee
    const identityCode = String(body.userId ?? "").trim();
    if (!identityCode) return jsonError("userId is required.", 400);
    const targetUser = await User.findOne({ companyIdentityCode: identityCode, company: actor.company }).select("_id");
    if (!targetUser) return jsonError("User not found in your company.", 404);
    targetUserId = String(targetUser._id);
  } else {
    // Employee — reporting for themselves
    targetUserId = userId;
    reportedByEmployee = true;
  }

  // Auto-assign senior security and HR (allow manual override)
  let seniorSecurityId: string | null = null;
  let hrId: string | null = null;

  if (body.assignedSeniorSecurityId) {
    const overrideSS = await User.findOne({
      _id: body.assignedSeniorSecurityId,
      company: actor.company,
      role: "security",
      isSeniorSecurity: true,
    }).select("_id");
    if (overrideSS) seniorSecurityId = String(overrideSS._id);
  }
  if (!seniorSecurityId) {
    const seniorSecurity = await User.findOne({
      company: actor.company,
      role: "security",
      isSeniorSecurity: true,
    }).select("_id");
    seniorSecurityId = seniorSecurity ? String(seniorSecurity._id) : null;
  }

  if (body.assignedHRId) {
    const overrideHr = await User.findOne({
      _id: body.assignedHRId,
      company: actor.company,
      role: "human-resource",
    }).select("_id");
    if (overrideHr) hrId = String(overrideHr._id);
  }
  if (!hrId) {
    const hrMember = await User.findOne({
      company: actor.company,
      role: "human-resource",
    }).select("_id");
    hrId = hrMember ? String(hrMember._id) : null;
  }

  const report = await LostCardReport.create({
    user: targetUserId,
    company: actor.company,
    reportedBy: userId,
    reportedByEmployee,
    status: "reported",
    reason: body.reason ?? "lost",
    lastLocation: String(body.lastLocation ?? "").trim(),
    lostDateTime: body.lostDateTime ? new Date(body.lostDateTime) : null,
    policeComplaintNumber: String(body.policeComplaintNumber ?? "").trim(),
    isEmergency: Boolean(body.isEmergency),
    notes: String(body.notes ?? "").trim(),
    assignedSeniorSecurity: seniorSecurityId,
    assignedHR: hrId,
    timeline: [{
      action: "reported",
      actor: userId,
      actorName: actor.name ?? "Unknown",
      timestamp: new Date(),
      notes: body.notes ? `Notes: ${String(body.notes)}` : "",
    }],
  });

  // Notify Security and HR
  const notifyUsers = await User.find({
    company: actor.company,
    role: { $in: ["security", "human-resource", "admin"] },
    _id: { $ne: userId },
  }).select("_id");

  for (const u of notifyUsers) {
    await Notification.create({
      user: u._id,
      company: actor.company,
      type: "approval",
      title: "New Lost Card Report",
      message: `A new lost card has been reported for ${body.userId || actor.name}. Reason: ${body.reason || "lost"}.`,
      body: `Employee: ${body.userId || actor.name}\nReason: ${body.reason || "lost"}\nLocation: ${body.lastLocation || "N/A"}\nEmergency: ${body.isEmergency ? "Yes" : "No"}`,
      link: "/profile-hub?tab=security",
    });
    emitNotification(String(u._id));
  }

  const populated = await LostCardReport.findById(report._id)
    .populate("user", "name email avatarUrl companyIdentityCode role")
    .populate("reportedBy", "name email role")
    .populate("assignedSeniorSecurity", "name email role")
    .populate("assignedHR", "name email role")
    .populate("followUpNotes.addedBy", "name email role")
    .lean() as Record<string, unknown> | null;

  return NextResponse.json({ report: populated ? serializeReport(populated) : null });
}
