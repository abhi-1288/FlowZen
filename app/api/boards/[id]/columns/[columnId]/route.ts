import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Column } from "@/models/Column";
import { findOwnedBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";

type Params = { params: Promise<{ id: string; columnId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id, columnId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id) || !isObjectId(columnId)) return jsonError("Invalid board or column id.");

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) return jsonError("Column title is required.");

  await connectDb();
  const board = await findOwnedBoard(id, userId);
  if (!board) return jsonError("Only the board owner can edit columns.", 403);

  const column = await Column.findOneAndUpdate({ _id: columnId, board: id }, { $set: { title } }, { new: true });
  if (!column) return jsonError("Column not found.", 404);

  return NextResponse.json({ column: serializeDoc(column) });
}
