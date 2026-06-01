import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { findAccessibleBoard, findOwnedBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { emitToBoard } from "@/lib/socket-emit";
import { deleteAttachments } from "@/lib/attachments";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  await connectDb();
  const board = await findOwnedBoard(id, userId);
  if (!board) return jsonError("Only the board owner can add columns.", 403);

  const columns = await Column.find({ board: id }).sort({ order: 1 });
  return NextResponse.json({ columns: serializeDocs(columns) });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) return jsonError("Column title is required.");

  await connectDb();
  const board = await findOwnedBoard(id, userId);
  if (!board) return jsonError("Only the board owner can reorder columns.", 403);

  const count = await Column.countDocuments({ board: id });
  const column = await Column.create({ board: id, title, order: count });
  emitToBoard(board, "board:update", id);
  return NextResponse.json({ column: serializeDoc(column) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const body = await request.json();
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
  if (!orderedIds.every((columnId: unknown) => typeof columnId === "string" && isObjectId(columnId))) {
    return jsonError("orderedIds must contain valid column ids.");
  }

  await connectDb();
  const board = await findOwnedBoard(id, userId);
  if (!board) return jsonError("Only the board owner can delete columns.", 403);

  await Promise.all(
    orderedIds.map((columnId: string, order: number) =>
      Column.updateOne({ _id: columnId, board: id }, { $set: { order } })
    )
  );

  const columns = await Column.find({ board: id }).sort({ order: 1 });
  return NextResponse.json({ columns: serializeDocs(columns) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid board id.");

  const columnId = new URL(request.url).searchParams.get("columnId") ?? "";
  if (!isObjectId(columnId)) return jsonError("Valid columnId query param is required.");

  await connectDb();
  const board = await findAccessibleBoard(id, userId);
  if (!board) return jsonError("Board not found.", 404);

  const tasksInColumn = await Task.find({ board: id, column: columnId });
  const attachmentsToDelete = tasksInColumn.flatMap(t => t.attachments || []);
  if (attachmentsToDelete.length > 0) {
    await deleteAttachments(attachmentsToDelete);
  }

  await Promise.all([
    Task.deleteMany({ board: id, column: columnId }),
    Column.deleteOne({ _id: columnId, board: id })
  ]);

  const columns = await Column.find({ board: id }).sort({ order: 1 });
  await Promise.all(columns.map((column, order) => Column.updateOne({ _id: column._id }, { $set: { order } })));

  emitToBoard(board, "board:update", id);
  return NextResponse.json({ ok: true });
}
