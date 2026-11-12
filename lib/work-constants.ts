/**
 * Shared, framework-free constants for task continuity and compactions.
 * Kept free of Mongoose imports so both server models and client components can
 * import them without pulling the database layer into the browser bundle.
 */

export const BOARD_TASK_STATUSES = [
  "not_started",
  "in_progress",
  "partially_completed",
  "completed",
  "blocked",
  "carried_forward",
  "cancelled",
] as const;

export type BoardTaskStatus = (typeof BOARD_TASK_STATUSES)[number];

export const BOARD_TODO_STATUSES = [
  "not_started",
  "in_progress",
  "partially_completed",
  "completed",
  "blocked",
  "carried_forward",
  "delegation_pending",
  "delegated",
  "pending_review",
  "approved",
  "reopened",
] as const;

export type BoardTodoStatus = (typeof BOARD_TODO_STATUSES)[number];

export const BOARD_TODO_STATUS_LABELS: Record<BoardTodoStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  partially_completed: "Partially Completed",
  completed: "Completed",
  blocked: "Blocked",
  carried_forward: "Carried Forward",
  delegation_pending: "Delegation Pending",
  delegated: "Delegated",
  pending_review: "Pending Review",
  approved: "Approved",
  reopened: "Reopened",
};

export const ACTIVE_TODO_STATUSES: BoardTodoStatus[] = [
  "not_started",
  "in_progress",
  "partially_completed",
  "blocked",
  "carried_forward",
  "delegation_pending",
  "delegated",
  "pending_review",
  "reopened",
];

export const FINISHED_TODO_STATUSES: BoardTodoStatus[] = ["completed", "approved"];

export const COMPACTION_TYPES = ["EOD", "EOW"] as const;
export type CompactionType = (typeof COMPACTION_TYPES)[number];

/**
 * The employee-compaction lifecycle. EOD and EOW share the post-submission
 * states so delivery/revision code only has to reason about one set.
 */
export const EMPLOYEE_COMPACTION_STATUSES = [
  "not_started",
  "pending_generation",
  "draft_ready",
  "draft",
  "awaiting_confirmation",
  "submitted",
  "delivered_to_team_owner",
  "email_pending",
  "email_sent",
  "delivery_failed",
  "correction_requested",
] as const;

export type EmployeeCompactionStatus =
  (typeof EMPLOYEE_COMPACTION_STATUSES)[number];

export const EMPLOYEE_COMPACTION_STATUS_LABELS: Record<
  EmployeeCompactionStatus,
  string
> = {
  not_started: "Not Started",
  pending_generation: "Pending Generation",
  draft_ready: "Draft Ready",
  draft: "Draft",
  awaiting_confirmation: "Awaiting Confirmation",
  submitted: "Submitted",
  delivered_to_team_owner: "Delivered to Team Owner",
  email_pending: "Email Pending",
  email_sent: "Email Sent",
  delivery_failed: "Delivery Failed",
  correction_requested: "Correction Requested",
};

export const EMPLOYEE_EDITABLE_STATUSES: EmployeeCompactionStatus[] = [
  "pending_generation",
  "draft_ready",
  "draft",
  "awaiting_confirmation",
  "correction_requested",
  "delivery_failed",
];

export const TEAM_COMPACTION_STATUSES = [
  "draft",
  "awaiting_team_owner_confirmation",
  "submitted_to_admin",
  "delivered",
  "email_sent",
  "under_admin_review",
  "correction_requested",
  "acknowledged",
  "archived",
] as const;

export type TeamCompactionStatus = (typeof TEAM_COMPACTION_STATUSES)[number];

export const TEAM_COMPACTION_STATUS_LABELS: Record<
  TeamCompactionStatus,
  string
> = {
  draft: "Draft",
  awaiting_team_owner_confirmation: "Awaiting Team Owner Confirmation",
  submitted_to_admin: "Submitted to Admin",
  delivered: "Delivered",
  email_sent: "Email Sent",
  under_admin_review: "Under Admin Review",
  correction_requested: "Correction Requested",
  acknowledged: "Acknowledged",
  archived: "Archived",
};

export const TEAM_EDITABLE_STATUSES: TeamCompactionStatus[] = [
  "draft",
  "awaiting_team_owner_confirmation",
  "correction_requested",
];

export const HANDOVER_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "reassigned",
] as const;

export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

export const COMPACTION_CATEGORIES = [
  "completed",
  "partial",
  "pending",
  "blocked",
] as const;

export type CompactionCategory = (typeof COMPACTION_CATEGORIES)[number];

/** Editable employee compaction body, mirroring `TaskCompaction.content`. */
export type CompactionContent = {
  completedWork: string[];
  partialWork: string[];
  pendingWork: string[];
  blockers: string[];
  decisions: string;
  handoverNotes: string;
  risks: string;
  nextActions: string;
  additionalNotes: string;
  attachmentIds: string[];
};

export function emptyCompactionContent(): CompactionContent {
  return {
    completedWork: [],
    partialWork: [],
    pendingWork: [],
    blockers: [],
    decisions: "",
    handoverNotes: "",
    risks: "",
    nextActions: "",
    additionalNotes: "",
    attachmentIds: [],
  };
}

export const DELIVERY_CHANNELS = ["in_app", "email"] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Roles that can administer company-wide team-compaction reporting. */
export const COMPANY_ADMIN_ROLES = ["admin"] as const;

/** Roles that may manage teams (used only as a hint; Team.manager wins). */
export const TEAM_LEAD_ROLES = [
  "project-manager",
  "qa-tester",
  "human-resource",
  "finance",
  "admin",
] as const;

export function isBoardTodoStatus(value: unknown): value is BoardTodoStatus {
  return BOARD_TODO_STATUSES.includes(value as BoardTodoStatus);
}

export function isCompactionType(value: unknown): value is CompactionType {
  return COMPACTION_TYPES.includes(value as CompactionType);
}

export function isEmployeeCompactionStatus(
  value: unknown,
): value is EmployeeCompactionStatus {
  return EMPLOYEE_COMPACTION_STATUSES.includes(
    value as EmployeeCompactionStatus,
  );
}

export function todoStatusLabel(status: string | null | undefined): string {
  return BOARD_TODO_STATUS_LABELS[status as BoardTodoStatus] ?? String(status ?? "");
}
