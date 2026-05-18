import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Task } from "@/models/Task";
import { findAccessibleBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id, taskId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id) || !isObjectId(taskId)) return jsonError("Invalid board or task id.");

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const url = String(body.url ?? "").trim();
  if (!name || !url) return jsonError("Attachment name and URL are required.");

  await connectDb();
  const board = await findAccessibleBoard(id, userId);
  if (!board) return jsonError("Board not found.", 404);

  const task = await Task.findOneAndUpdate(
    { _id: taskId, board: id },
    {
      $push: {
        attachments: { id: randomUUID(), name, url },
        activity: { user: userId, action: "attach", detail: `Attached ${name}` }
      }
    },
    { new: true }
  );
  if (!task) return jsonError("Task not found.", 404);

  return NextResponse.json({ task: serializeDoc(task) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id, taskId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id) || !isObjectId(taskId)) return jsonError("Invalid board or task id.");

  const body = await request.json();
  const attachmentId = String(body.attachmentId ?? "").trim();
  if (!attachmentId) return jsonError("attachmentId is required.");

  await connectDb();
  const board = await findAccessibleBoard(id, userId);
  if (!board) return jsonError("Board not found.", 404);

  const task = await Task.findOneAndUpdate(
    { _id: taskId, board: id },
    {
      $pull: { attachments: { id: attachmentId } },
      $push: { activity: { user: userId, action: "attach-remove", detail: "Attachment removed" } }
    },
    { new: true }
  );
  if (!task) return jsonError("Task not found.", 404);

  return NextResponse.json({ task: serializeDoc(task) });
}
