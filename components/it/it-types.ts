"use client";

export type ItTicketStatus =
  | "PENDING"
  | "ASSIGNED"
  | "QUEUED"
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "AWAITING_CONFIRMATION"
  | "RESOLVED"
  | "CANCELLED";

export type ItTicketCategory =
  | "ACCOUNT_LOGIN"
  | "ACCESS_PERMISSION"
  | "HARDWARE"
  | "SOFTWARE"
  | "NETWORK"
  | "EMAIL"
  | "PRINTER_PERIPHERAL"
  | "SECURITY"
  | "ACCOUNT_CREATION"
  | "OTHER";

export type ItTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ItResolutionType =
  | "ACCESS_CORRECTED"
  | "HARDWARE_REPAIRED"
  | "SOFTWARE_INSTALLED"
  | "CONFIGURATION_CHANGED"
  | "PASSWORD_ACCOUNT_FIXED"
  | "NETWORK_ISSUE_FIXED"
  | "USER_GUIDEANCE"
  | "OTHER";

export type ItTicketAttachment = { id: string; name: string; url: string };

export type ItTicketComment = {
  id: string;
  user: { id: string; name: string; email: string } | string;
  body: string;
  createdAt: string;
};

export type ItTicketActivity = {
  id: string;
  user: { id: string; name: string; email: string } | string;
  action: string;
  detail?: string;
  createdAt: string;
};

export type ItTicket = {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: ItTicketCategory;
  priority: ItTicketPriority;
  status: ItTicketStatus;
  requester: {
    id: string;
    name: string;
    email: string;
    role?: string;
    phone?: string;
    emergencyContact?: string;
    department?: string;
    customRole?: string;
    companyIdentityCode?: string;
    avatarUrl?: string;
  } | string;
  department: string;
  manager?: string | { id: string; name: string } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  assignedBy?: string | null;
  assignedAt?: string | null;
  itTeam?: string | null;
  resolution?: string | null;
  resolutionType?: ItResolutionType | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  employeeConfirmed?: boolean | null;
  confirmedAt?: string | null;
  cancelReason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  comments: ItTicketComment[];
  attachments: ItTicketAttachment[];
  activity: ItTicketActivity[];
  company?: string | { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type ItCode = {
  id: string;
  code: string;
  createdBy: string | { id: string; name: string };
  company?: string;
  intendedRole?: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount?: number;
  usedBy?: unknown[];
  status?: string;
  createdAt: string;
  updatedAt: string;
};

export type ItProvisioningRequest = {
  id: string;
  employee?: string | { id: string; name: string };
  employeeName: string;
  department: string;
  designation: string;
  email: string;
  manager?: string | { id: string; name: string } | null;
  managerName?: string;
  requestedRole: string;
  requiredAccess: string;
  createdBy?: string | { id: string; name: string };
  createdByName?: string;
  company?: string;
  status: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  accountCreatedAt?: string | null;
  createdAccountUserId?: string | null;
  notes?: string;
  activity?: ItTicketActivity[];
  createdAt: string;
};

export type ItTeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  workload: { assigned: number; inProgress: number; resolved: number };
};

export const CANCEL_ALLOWED_STATUSES: ItTicketStatus[] = [
  "PENDING",
  "ASSIGNED",
  "QUEUED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
];

export const IT_STATUS_LABELS: Record<ItTicketStatus, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  QUEUED: "Queued",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_USER: "Waiting for User",
  AWAITING_CONFIRMATION: "Awaiting Confirmation",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

export const IT_STATUS_COLORS: Record<ItTicketStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  QUEUED: "bg-violet-50 text-violet-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  WAITING_FOR_USER: "bg-orange-50 text-orange-700",
  AWAITING_CONFIRMATION: "bg-teal-50 text-teal-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

export const IT_CATEGORY_LABELS: Record<ItTicketCategory, string> = {
  ACCOUNT_LOGIN: "Account Login",
  ACCESS_PERMISSION: "Access / Permission",
  HARDWARE: "Hardware",
  SOFTWARE: "Software",
  NETWORK: "Network",
  EMAIL: "Email",
  PRINTER_PERIPHERAL: "Printer / Peripheral",
  SECURITY: "Security",
  ACCOUNT_CREATION: "Account Creation",
  OTHER: "Other",
};

export const IT_PRIORITY_LABELS: Record<ItTicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const IT_PRIORITY_COLORS: Record<ItTicketPriority, string> = {
  LOW: "bg-sky-50 text-sky-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-rose-50 text-rose-700",
  URGENT: "bg-red-600 text-white",
};

export const IT_RESOLUTION_TYPE_LABELS: Record<ItResolutionType, string> = {
  ACCESS_CORRECTED: "Access Corrected",
  HARDWARE_REPAIRED: "Hardware Repaired",
  SOFTWARE_INSTALLED: "Software Installed",
  CONFIGURATION_CHANGED: "Configuration Changed",
  PASSWORD_ACCOUNT_FIXED: "Password / Account Fixed",
  NETWORK_ISSUE_FIXED: "Network Issue Fixed",
  USER_GUIDEANCE: "User Guidance",
  OTHER: "Other",
};

export const IT_CANCEL_REASONS: string[] = [
  "Issue resolved on my own",
  "Duplicate ticket",
  "No longer needed",
  "Wrong category",
  "Other",
];

export const ALL_IT_STATUSES: ItTicketStatus[] = [
  "PENDING",
  "ASSIGNED",
  "QUEUED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "AWAITING_CONFIRMATION",
  "RESOLVED",
  "CANCELLED",
];

export function requesterId(r: ItTicket["requester"]): string {
  if (typeof r === "string") return r;
  return String((r as any).id ?? (r as any)._id ?? "");
}

export function requesterName(r: ItTicket["requester"]): string {
  return typeof r === "string" ? r : r.name;
}

export function userObj(u: ItTicketComment["user"]): { id: string; name: string } {
  if (typeof u === "string") return { id: u, name: u };
  return { id: String((u as any).id ?? (u as any)._id ?? ""), name: u.name };
}
