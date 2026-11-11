export const EMPLOYEE_TASK_MODES = ["approval", "allowed", "blocked"] as const;

export type EmployeeTaskMode = (typeof EMPLOYEE_TASK_MODES)[number];

export const DEFAULT_EMPLOYEE_TASK_MODE: EmployeeTaskMode = "approval";

/**
 * Company roles that are allowed to create tasks without approval. These are
 * the "upper" roles: admins, managers, testers, HR and finance.
 */
const DIRECT_CREATOR_USER_ROLES = [
  "admin",
  "project-manager",
  "qa-tester",
  "finance",
  "human-resource",
];

const DIRECT_CREATOR_BOARD_ROLES = ["admin", "manager", "tester"];

type BoardLike = {
  owner?: unknown;
  members?: { user?: unknown; role?: string }[];
  employeeTaskCreation?: string;
} | null | undefined;

function idOf(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as { id?: unknown; _id?: unknown };
    return String(record.id ?? record._id ?? "");
  }
  return String(value);
}

export function boardRoleForUser(board: BoardLike, userId?: string | null) {
  if (!board || !userId) return "";
  const member = (board.members ?? []).find((item) => idOf(item.user) === userId);
  return String(member?.role ?? "");
}

export function normalizeEmployeeTaskMode(value: unknown): EmployeeTaskMode {
  return EMPLOYEE_TASK_MODES.includes(value as EmployeeTaskMode)
    ? (value as EmployeeTaskMode)
    : DEFAULT_EMPLOYEE_TASK_MODE;
}

export function isDirectCreatorRole(userRole?: string | null) {
  return Boolean(userRole && DIRECT_CREATOR_USER_ROLES.includes(userRole));
}

/**
 * Owner, board-level managers/testers/admins, and company-level upper roles can
 * create tasks immediately and review employee submissions.
 */
export function canManageBoardTasks(
  board: BoardLike,
  userId?: string | null,
  userRole?: string | null
) {
  if (!board || !userId) return false;
  if (idOf(board.owner) === userId) return true;
  if (isDirectCreatorRole(userRole)) return true;
  return DIRECT_CREATOR_BOARD_ROLES.includes(boardRoleForUser(board, userId));
}

/**
 * Employees and "others" can still open the create form while the board is in
 * `approval` mode; their task is created in a pending state. `blocked` hides
 * task creation for them entirely.
 */
export function canCreateTaskOnBoard(
  board: BoardLike | null,
  userId?: string | null,
  userRole?: string | null
) {
  if (!board || !userId) return false;
  if (canManageBoardTasks(board, userId, userRole)) return true;
  return normalizeEmployeeTaskMode(board.employeeTaskCreation) !== "blocked";
}

export function requiresTaskApproval(
  board: BoardLike | null,
  userId?: string | null,
  userRole?: string | null
) {
  if (!board || !userId) return false;
  if (canManageBoardTasks(board, userId, userRole)) return false;
  return normalizeEmployeeTaskMode(board.employeeTaskCreation) === "approval";
}
