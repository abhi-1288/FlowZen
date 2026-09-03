export type Role = "admin" | "manager" | "employee" | "tester" | "others";
export type UserRole = "employee" | "project-manager" | "qa-tester" | "human-resource" | "finance" | "admin" | "security" | "it-admin" | "it-administration" | "others";
export type Priority = "low" | "medium" | "high";

export type ITTicketStatus =
  | "PENDING"
  | "ASSIGNED"
  | "QUEUED"
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "AWAITING_CONFIRMATION"
  | "RESOLVED"
  | "CANCELLED";

export type ITTicketCategory =
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

export type ITPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ITResolutionType =
  | "ACCESS_CORRECTED"
  | "HARDWARE_REPAIRED"
  | "SOFTWARE_INSTALLED"
  | "CONFIGURATION_CHANGED"
  | "PASSWORD_ACCOUNT_FIXED"
  | "NETWORK_ISSUE_FIXED"
  | "USER_GUIDEANCE"
  | "OTHER";

export type ITProvisioningStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "ACCOUNT_CREATED"
  | "COMPLETED"
  | "REJECTED";

export type Board = {
  id: string;
  title: string;
  description: string;
  owner: string;
  members: { user: string; assignedTo?: string | null; role: Role }[];
  attachments: { id: string; name: string; url: string }[];
  createdAt: string;
  updatedAt: string;
};

export type Column = {
  id: string;
  board: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  board: string;
  column: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: Priority;
  order: number;
  assignees: string[];
  takenBy?: string | null;
  takenByName?: string;
  takenLead?: string | null;
  takenLeadName?: string;
  takenTeam?: string | null;
  takenTeamName?: string;
  attachments: { id: string; name: string; url: string }[];
  subTasks: { id: string; title: string; done: boolean }[];
  comments: { user: string; body: string; createdAt: string; updatedAt: string }[];
  activity: { user: string; action: string; detail: string; createdAt: string; updatedAt: string }[];
  createdAt: string;
  updatedAt: string;
};

export type BoardPayload = {
  board: Board;
  columns: Column[];
  tasks: Task[];
};
