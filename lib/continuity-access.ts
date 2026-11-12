/**
 * Authorization helpers for major tasks, todos and handovers. All checks are
 * server-side and derive access from persisted board membership / task
 * ownership / team management / company admin role.
 */

import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { Task } from "@/models/Task";
import { BoardTodo } from "@/models/BoardTodo";
import { Team } from "@/models/Team";
import { User } from "@/models/User";

type AnyDoc = Record<string, any>;

export type ContinuityActor = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  team: string | null;
  isCompanyAdmin: boolean;
  managesTeams: string[];
  boardIds: string[];
};

function idOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const record = value as { _id?: unknown; id?: unknown };
  return String(record._id ?? record.id ?? "");
}

export async function getContinuityActor(userId: string): Promise<ContinuityActor | null> {
  await connectDb();
  const user = await User.findById(userId).select("name role company companyStatus");
  if (!user) return null;

  const company = idOf(user.company);
  const [boards, teams] = await Promise.all([
    Board.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    }).select("_id"),
    Team.find({ manager: userId }).select("_id"),
  ]);

  return {
    id: String(user._id),
    name: String(user.name ?? ""),
    role: String(user.role ?? ""),
    company: company || null,
    team: idOf((user as AnyDoc).team) || null,
    isCompanyAdmin: company
      ? String(user.role) === "admin" && String((user as AnyDoc).companyStatus ?? "") === "approved"
      : false,
    managesTeams: teams.map((team) => String(team._id)),
    boardIds: boards.map((board) => String(board._id)),
  };
}

export function actorHasGlobalBoardAccess(actor: ContinuityActor): boolean {
  return (
    actor.isCompanyAdmin ||
    [
      "project-manager",
      "qa-tester",
      "human-resource",
      "finance",
      "admin",
    ].includes(actor.role)
  );
}

export async function getAccessibleTask(
  taskId: string,
  actor: ContinuityActor,
): Promise<{ task: AnyDoc; board: AnyDoc | null } | null> {
  const task = await Task.findById(taskId);
  if (!task) return null;
  const boardId = idOf(task.board);
  const board = boardId ? await Board.findById(boardId) : null;

  const isBoardAccess = Boolean(boardId) && actor.boardIds.includes(boardId);
  const isTaskOwner =
    [task.owner, task.createdBy, task.takenBy, task.takenLead].some(
      (value) => idOf(value) === actor.id,
    ) ||
    (Array.isArray(task.assignees) &&
      task.assignees.some((value: unknown) => idOf(value) === actor.id));

  if (!isBoardAccess && !isTaskOwner && !actorHasGlobalBoardAccess(actor)) return null;
  if (
    actor.company &&
    (task as AnyDoc).company &&
    String((task as AnyDoc).company) !== actor.company &&
    !actorHasGlobalBoardAccess(actor)
  ) {
    return null;
  }
  return { task: task as AnyDoc, board: board as AnyDoc | null };
}

export async function getAccessibleTodo(
  todoId: string,
  actor: ContinuityActor,
): Promise<{ todo: AnyDoc; task: AnyDoc | null } | null> {
  const todo = await BoardTodo.findById(todoId);
  if (!todo) return null;
  const task = todo.task ? await Task.findById(todo.task) : null;

  const isAssigned =
    idOf(todo.assigneeId) === actor.id ||
    idOf(todo.originalOwnerId) === actor.id;
  const isBoardMember = todo.board ? actor.boardIds.includes(idOf(todo.board)) : false;
  const isTaskMember = Boolean(
    task &&
      ([task.owner, task.createdBy, task.takenBy].some((value) => idOf(value) === actor.id) ||
        (Array.isArray(task.assignees) &&
          task.assignees.some((value: unknown) => idOf(value) === actor.id))),
  );
  const isTeamOwner = Boolean(
    todo.company && actor.company && String(todo.company) === actor.company && actor.managesTeams.length,
  );

  if (!isAssigned && !isBoardMember && !isTaskMember && !isTeamOwner && !actorHasGlobalBoardAccess(actor)) {
    return null;
  }
  if (
    actor.company &&
    todo.company &&
    String(todo.company) !== actor.company &&
    !actorHasGlobalBoardAccess(actor)
  ) {
    return null;
  }
  return { todo: todo as AnyDoc, task: task as AnyDoc | null };
}

export function canManageTodo(todo: AnyDoc, actor: ContinuityActor): boolean {
  if (actorHasGlobalBoardAccess(actor)) return true;
  return (
    idOf(todo.assigneeId) === actor.id ||
    idOf(todo.originalOwnerId) === actor.id ||
    (todo.board ? actor.boardIds.includes(idOf(todo.board)) : false)
  );
}

export function canManageTask(task: AnyDoc, actor: ContinuityActor): boolean {
  if (actorHasGlobalBoardAccess(actor)) return true;
  if (idOf(task.owner) === actor.id) return true;
  if (task.board ? actor.boardIds.includes(idOf(task.board)) : false) return true;
  return false;
}

export function canUpdateTodoProgress(todo: AnyDoc, actor: ContinuityActor): boolean {
  // Progress and completion notes belong to the assignee (or an authorised
  // manager), never to an unrelated board viewer.
  if (idOf(todo.assigneeId) === actor.id) return true;
  if (idOf(todo.originalOwnerId) === actor.id) return true;
  return canManageTodo(todo, actor);
}
