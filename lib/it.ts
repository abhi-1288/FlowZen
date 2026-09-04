import type { Types } from "mongoose";
import { ITTicket } from "@/models/ITTicket";
import { User } from "@/models/User";

export type ITTicketActor = {
  role: string;
  _id: Types.ObjectId | string;
};

export function isItAdminRole(role: string): boolean {
  return String(role) === "it-admin";
}

export function isItAdministrationRole(role: string): boolean {
  return String(role) === "it-administration";
}

export function isItStaff(role: string): boolean {
  const r = String(role);
  return r === "it-admin" || r === "it-administration";
}

/** Effective senior IT authority: IT_ADMIN, plus company admin/HR (admin+HR act as overseers). */
export function canManageIt(role: string, isSeniorSecurity = false): boolean {
  const r = String(role);
  return r === "it-admin" || r === "admin" || r === "human-resource" || (r === "security" && isSeniorSecurity);
}

/**
 * Allowed status transitions — enforced on the backend. This is the single source
 * of truth so drag-and-drop and direct PATCH calls cannot bypass business rules.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["QUEUED", "IN_PROGRESS", "CANCELLED", "ASSIGNED"],
  QUEUED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_USER", "AWAITING_CONFIRMATION", "CANCELLED"],
  WAITING_FOR_USER: ["IN_PROGRESS", "CANCELLED"],
  AWAITING_CONFIRMATION: ["RESOLVED", "IN_PROGRESS"],
  RESOLVED: ["IN_PROGRESS"],
  CANCELLED: [],
};

export function canTransitionTicket(from: string, to: string): boolean {
  const fromKey = String(from).toUpperCase();
  const toKey = String(to).toUpperCase();
  if (fromKey === toKey) return true;
  const allowed = ALLOWED_TRANSITIONS[fromKey] ?? [];
  return allowed.includes(toKey);
}

/**
 * Server-side visibility scoping.
 * - employee/others: only their own tickets
 * - it-administration: tickets assigned to them, or explicitly visible to their IT team
 * - it-admin (and admin/hr overseers): all IT tickets
 */
export async function ticketVisibilityFilter(
  actor: ITTicketActor,
  companyId: Types.ObjectId | string,
): Promise<Record<string, unknown>> {
  const role = String(actor.role);
  const base: Record<string, unknown> = { company: companyId };
  if (role === "it-admin" || role === "admin" || role === "human-resource") {
    return base;
  }
  if (isItAdministrationRole(role)) {
    const actorId = String(actor._id);
    const member = await User.findById(actorId).select("activeTeams team").lean();
    const teamIds = Array.isArray((member as any)?.activeTeams)
      ? (member as any).activeTeams.map((t: unknown) => String(t))
      : [];
    if ((member as any)?.team) teamIds.push(String((member as any).team));
    return {
      company: companyId,
      $or: [{ assignedTo: actorId }, { itTeam: { $in: teamIds } }],
    };
  }
  // employees / others
  return {
    company: companyId,
    requester: String(actor._id),
  };
}

export async function canViewTicket(
  actor: ITTicketActor,
  companyId: Types.ObjectId | string,
  ticket: any,
): Promise<boolean> {
  const role = String(actor.role);
  const actorId = String(actor._id);
  const ticketCompanyId = String(ticket.company ?? "");
  if (ticketCompanyId && ticketCompanyId !== String(companyId)) return false;

  if (role === "it-admin" || role === "admin" || role === "human-resource") return true;
  if (isItAdministrationRole(role)) {
    const assigned = ticket.assignedTo ? String(ticket.assignedTo) === actorId : false;
    const teamMatch = ticket.itTeam
      ? await isUserInItTeam(actorId, String(ticket.itTeam))
      : false;
    return assigned || teamMatch;
  }
  // employees / others
  return ticket.requester ? String(ticket.requester) === actorId : false;
}

export async function isUserInItTeam(userId: string, teamId: string): Promise<boolean> {
  const member = await User.findById(userId).select("activeTeams team").lean();
  if (!member) return false;
  const ids = Array.isArray((member as any).activeTeams)
    ? (member as any).activeTeams.map((t: unknown) => String(t))
    : [];
  if ((member as any).team) ids.push(String((member as any).team));
  return ids.includes(teamId);
}

export async function nextTicketNumber(companyId: Types.ObjectId | string): Promise<string> {
  const last = await ITTicket.findOne({ company: companyId })
    .sort({ createdAt: -1 })
    .select("ticketNumber");
  let lastNumber = 0;
  if (last?.ticketNumber) {
    const match = String(last.ticketNumber).match(/(\d+)$/);
    if (match) lastNumber = Number(match[1]);
  }
  const next = Math.max(lastNumber + 1, 1001);
  return `IT-${next}`;
}

export function pushItActivity(
  ticket: any,
  user: { _id: unknown; name?: string },
  action: string,
  detail = "",
) {
  if (!Array.isArray(ticket.activity)) ticket.activity = [];
  ticket.activity.push({
    user: user._id,
    action,
    detail: detail || action,
  });
}

export function pushProvisioningActivity(
  req: any,
  user: { _id: unknown },
  action: string,
  detail = "",
) {
  if (!Array.isArray(req.activity)) req.activity = [];
  req.activity.push({
    user: user._id,
    action,
    detail: detail || action,
  });
}
