import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { findAccessibleBoard, findOwnedBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { emitToBoard } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  await connectDb();
  const board = await findAccessibleBoard(id, userId);
  if (!board) return jsonError("Board not found.", 404);
  await board.populate("members.user", "name email");
  await board.populate("members.assignedTo", "name email");

  const [columns, tasks] = await Promise.all([
    Column.find({ board: id }).sort({ order: 1 }).exec(),
    Task.find({ board: id }).sort({ column: 1, order: 1 }).exec()
  ]);

  const expiredColumn = columns.find((column) => column.title.toLowerCase() === "expired-due");
  if (expiredColumn) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiredTasks = tasks.filter(
      (task) => task.dueDate && new Date(task.dueDate).getTime() < now.getTime() && String(task.column) !== String(expiredColumn._id)
    );
    if (expiredTasks.length) {
      const maxOrderTask = await Task.findOne({ board: id, column: expiredColumn._id }).sort({ order: -1 }).select("order");
      let nextOrder = typeof maxOrderTask?.order === "number" ? maxOrderTask.order + 1 : 0;
      for (const task of expiredTasks) {
        await Task.updateOne({ _id: task._id }, { $set: { column: expiredColumn._id, order: nextOrder } });
        nextOrder += 1;
      }
    }
  }

  const refreshedTasks = await Task.find({ board: id }).sort({ column: 1, order: 1 });

  return NextResponse.json({
    board: serializeDoc(board),
    columns: serializeDocs(columns),
    tasks: serializeDocs(refreshedTasks)
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const updates: Record<string, any> = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.description !== undefined) updates.description = String(body.description).trim();
  if (body.attachments !== undefined && Array.isArray(body.attachments)) {
    updates.attachments = body.attachments.map((a: any) => ({
      id: String(a.id || ""),
      name: String(a.name || ""),
      url: String(a.url || "")
    })).filter((a: any) => a.id && a.name && a.url);
  }

  await connectDb();
  const board = await Board.findOneAndUpdate({ _id: id, owner: userId }, { $set: updates }, { new: true });
  if (!board) return jsonError("Only the owner can update this board or board not found.", 403);

  emitToBoard(board, "board:update", id);
  return NextResponse.json({ board: serializeDoc(board) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  await connectDb();
  const board = await findOwnedBoard(id, userId);
  if (!board) return jsonError("Only the owner can delete this board.", 403);

  await Promise.all([
    Task.deleteMany({ board: id }),
    Column.deleteMany({ board: id }),
    Board.deleteOne({ _id: id })
  ]);

  emitToBoard(board, "board:update", id);
  return NextResponse.json({ ok: true });
}
