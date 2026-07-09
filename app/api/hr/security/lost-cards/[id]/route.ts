import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { LostCardReport } from "@/models/LostCardReport";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { ATSAuditLog } from "@/models/ATSAuditLog";

type ActorDoc = { _id: string; name: string; role: string; company?: string | null };

// ── Allowed transitions per role ─────────────────────────────

type Transition = {
  roles: string[];
  set?: Record<string, unknown>;
  notifyRoles?: string[];
  notifyTitle?: string;
  notifyMessage?: string;
  notifyBody?: string;
  notifyLink?: string;
};

function makeTransition(
  partial: Omit<Transition, "roles"> & { roles?: string[] },
): Transition {
  return { roles: partial.roles ?? ["admin", "human-resource", "security"], ...partial };
}

const ALLOWED_TRANSITIONS: Record<string, Record<string, Transition>> = {
  reported: {
    "under-verification": makeTransition({
      set: { verifiedBy: "actorId", verifiedAt: new Date() },
      notifyRoles: ["human-resource"],
      notifyTitle: "Lost Card Under Verification",
      notifyMessage: "A lost card report is being verified by security.",
      notifyLink: "/profile-hub?tab=security",
    }),
    rejected: makeTransition({
      set: { rejectedBy: "actorId", rejectedAt: new Date(), rejectionReason: "notes" },
      notifyRoles: ["human-resource"],
      notifyTitle: "Lost Card Report Rejected",
      notifyMessage: "A lost card report has been rejected.",
      notifyLink: "/profile-hub?tab=security",
    }),
    found: makeTransition({
      set: { oldCardFound: true },
      notifyRoles: ["human-resource"],
      notifyTitle: "Lost Card Found",
      notifyMessage: "A reported lost card has been found.",
      notifyLink: "/profile-hub?tab=security",
    }),
  },
  "under-verification": {
    "replacement-approved": makeTransition({
      roles: ["admin", "human-resource", "security"],
      set: { approvedBy: "actorId", approvedAt: new Date(), assignedSecurity: "actorId" },
      notifyRoles: ["security"],
      notifyTitle: "Replacement Approved",
      notifyMessage: "Card replacement has been approved — please disable building access.",
      notifyLink: "/profile-hub?tab=security",
    }),
    rejected: makeTransition({
      roles: ["admin", "human-resource", "security"],
      set: { rejectedBy: "actorId", rejectedAt: new Date(), rejectionReason: "notes" },
      notifyRoles: ["human-resource"],
      notifyTitle: "Replacement Rejected",
      notifyMessage: "Card replacement request has been rejected.",
      notifyLink: "/profile-hub?tab=security",
    }),
    found: makeTransition({
      set: { oldCardFound: true },
      notifyRoles: ["human-resource"],
      notifyTitle: "Lost Card Found",
      notifyMessage: "A lost card under verification has been found.",
      notifyLink: "/profile-hub?tab=security",
    }),
  },
  "replacement-approved": {
    "card-disabled": makeTransition({
      roles: ["admin", "security"],
      set: { cardDisabledBy: "actorId", cardDisabledAt: new Date() },
      notifyRoles: ["human-resource"],
      notifyTitle: "Building Access Disabled",
      notifyMessage: "Building access has been disabled for the lost card — HR approval needed.",
      notifyLink: "/profile-hub?tab=security",
    }),
  },
  "card-disabled": {
    "hr-approved": makeTransition({
      roles: ["admin", "human-resource"],
      set: { hrApprovedBy: "actorId", hrApprovedAt: new Date() },
      notifyRoles: ["admin"],
      notifyTitle: "HR Approved — Ready to Print",
      notifyMessage: "HR has approved the replacement. New card can now be printed.",
      notifyLink: "/profile-hub?tab=security",
    }),
    rejected: makeTransition({
      roles: ["admin", "human-resource"],
      set: { rejectedBy: "actorId", rejectedAt: new Date(), rejectionReason: "notes" },
      notifyRoles: ["security", "human-resource"],
      notifyTitle: "Replacement Rejected by HR",
      notifyMessage: "HR has rejected the card replacement request.",
      notifyLink: "/profile-hub?tab=security",
    }),
  },
  "hr-approved": {
    printing: makeTransition({
      roles: ["admin"],
      set: {
        printedBy: "actorId",
        printedAt: new Date(),
        newCardNumber: "cardNumber",
        newRfidUid: "rfidUid",
        issueDate: "issueDate",
        expiryDate: "expiryDate",
      },
      notifyRoles: ["admin"],
      notifyTitle: "Card Printing",
      notifyMessage: "New card is being printed.",
      notifyLink: "/profile-hub?tab=security",
    }),
  },
  printing: {
    "ready-for-pickup": makeTransition({
      roles: ["admin"],
      set: {},
      notifyRoles: ["security"],
      notifyTitle: "Card Ready for Pickup",
      notifyMessage: "New card is ready for the employee to collect.",
      notifyLink: "/profile-hub?tab=security",
    }),
  },
  "ready-for-pickup": {
    completed: makeTransition({
      roles: ["admin", "security"],
      set: { collectedBy: "actorId", collectedAt: new Date(), collectionVerificationMethod: "notes" },
      notifyRoles: ["human-resource", "admin"],
      notifyTitle: "Card Collection Completed",
      notifyMessage: "Employee has collected their new card.",
      notifyLink: "/profile-hub?tab=security",
    }),
  },
};

// ── PATCH ────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const role = String(actor.role);
  const isAllowed = ["admin", "human-resource", "security"].includes(role);
  if (!isAllowed) return jsonError("Forbidden.", 403);

  const { id } = await params;
  const body = await request.json();
  const newStatus = String(body.status ?? "").trim();

  const report = await LostCardReport.findOne({ _id: id, company: actor.company });
  if (!report) return jsonError("Not found.", 404);

  const currentStatus = report.status;
  const transitions = ALLOWED_TRANSITIONS[currentStatus];
  if (!transitions || !transitions[newStatus]) {
    return jsonError(`Transition from "${currentStatus}" to "${newStatus}" is not allowed.`, 400);
  }

  const transition = transitions[newStatus];

  // Role check
  if (!transition.roles.includes(role)) {
    return jsonError("Your role cannot perform this transition.", 403);
  }

  // Build update
  const update: Record<string, unknown> = { status: newStatus };
  if (transition.set) {
    for (const [field, value] of Object.entries(transition.set)) {
      if (value === "actorId") {
        update[field] = userId;
      } else if (value === "notes") {
        update[field] = String(body.notes ?? "").trim();
      } else if (value === "cardNumber") {
        update[field] = String(body.cardNumber ?? "").trim();
      } else if (value === "rfidUid") {
        update[field] = String(body.rfidUid ?? "").trim();
      } else if (value === "issueDate") {
        update[field] = body.issueDate ? new Date(body.issueDate) : new Date();
      } else if (value === "expiryDate") {
        update[field] = body.expiryDate ? new Date(body.expiryDate) : null;
      } else if (value instanceof Date) {
        update[field] = value;
      } else {
        update[field] = value;
      }
    }
  }

  // Append timeline entry
  const timelineEntry = {
    action: newStatus,
    actor: userId,
    actorName: actor.name ?? "Unknown",
    timestamp: new Date(),
    notes: String(body.notes ?? "").trim(),
  };
  update.$push = { timeline: timelineEntry as any };

  const updated = await LostCardReport.findOneAndUpdate(
    { _id: id, company: actor.company },
    update,
    { new: true },
  )
    .populate("user", "name email avatarUrl companyIdentityCode role")
    .populate("assignedSecurity", "name email role")
    .populate("assignedSeniorSecurity", "name email role")
    .populate("assignedHR", "name email role")
    .populate("assignedJuniorSecurity", "name email role")
    .populate("followUpNotes.addedBy", "name email role")
    .lean() as Record<string, unknown> | null;

  if (!updated) return jsonError("Not found.", 404);

  // Audit log
  await ATSAuditLog.create({
    actor: userId,
    action: `lost-card-${newStatus}`,
    entityType: "LostCardReport",
    entityId: id,
    metadata: { from: currentStatus, to: newStatus, notes: body.notes || "" },
    company: actor.company,
  });

  // Notifications
  if (transition.notifyRoles && transition.notifyRoles.length > 0) {
    const notifyUsers = await User.find({
      company: actor.company,
      role: { $in: transition.notifyRoles },
      _id: { $ne: userId },
    }).select("_id");

    for (const u of notifyUsers) {
      await Notification.create({
        user: u._id,
        company: actor.company,
        type: "approval",
        title: transition.notifyTitle ?? "Card Status Update",
        message: transition.notifyMessage ?? `Status changed to "${newStatus}".`,
        body: transition.notifyBody ?? `Report: ${String(updated.user ? (updated.user as any).name || "" : "")}\nNew Status: ${newStatus}`,
        link: transition.notifyLink ?? "/profile-hub?tab=security",
      });
      emitNotification(String(u._id));
    }
  }

  // Notify the employee whose card it is
  const employeeId = updated.user ? String((updated.user as any)._id) : "";
  if (employeeId && employeeId !== userId) {
    let empTitle = "";
    let empMessage = "";
    if (newStatus === "ready-for-pickup") {
      empTitle = "Your Replacement Card Is Ready";
      empMessage = "Your new ID card is ready for pickup at the security desk.";
    } else if (newStatus === "completed") {
      empTitle = "Card Collection Confirmed";
      empMessage = "You have collected your new ID card.";
    } else if (newStatus === "rejected") {
      empTitle = "Replacement Request Update";
      empMessage = "Your card replacement request has been reviewed. Contact HR for details.";
    }
    if (empTitle) {
      await Notification.create({
        user: employeeId,
        company: actor.company,
        type: "approval",
        title: empTitle,
        message: empMessage,
        link: "/profile-hub?tab=security",
      });
      emitNotification(employeeId);
    }
  }

  return NextResponse.json({ report: updated });
}
