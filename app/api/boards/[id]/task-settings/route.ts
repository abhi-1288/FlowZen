import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { User } from "@/models/User";
import { findAccessibleBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToBoard } from "@/lib/socket-emit";
import {
  EMPLOYEE_TASK_MODES,
  canManageBoardTasks,
  normalizeEmployeeTaskMode
} from "@/lib/task-permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  await connectDb();
  const board = await findAccessibleBoard(id, userId);
  if (!board) return jsonError("Board not found.", 404);

  return NextResponse.json({
    employeeTaskCreation: normalizeEmployeeTaskMode(board.employeeTaskCreation)
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const mode = String(body.employeeTaskCreation ?? "");
  if (!EMPLOYEE_TASK_MODES.includes(mode as (typeof EMPLOYEE_TASK_MODES)[number])) {
    return jsonError("employeeTaskCreation must be approval, allowed or blocked.");
  }

  await connectDb();
  const [board, caller] = await Promise.all([
    findAccessibleBoard(id, userId),
    User.findById(userId).select("role")
  ]);
  if (!board) return jsonError("Board not found.", 404);
  if (!caller) return jsonError("User not found.", 404);

  if (!canManageBoardTasks(board, userId, String(caller.role))) {
    return jsonError(
      "Only the board owner, managers, testers, HR, finance or admins can change task permissions.",
      403
    );
  }

  board.employeeTaskCreation = mode as (typeof EMPLOYEE_TASK_MODES)[number];
  await board.save();

  await board.populate("members.user", "name email");
  await board.populate("members.assignedTo", "name email");

  emitToBoard(board, "board:update", id);
  return NextResponse.json({ board: serializeDoc(board) });
}
