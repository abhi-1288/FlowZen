import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Task } from "@/models/Task";
import { Notification } from "@/models/Notification";
import { findAccessibleBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id, taskId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id) || !isObjectId(taskId)) return jsonError("Invalid board or task id.");

  const body = await request.json();
  const comment = String(body.body ?? "").trim();
  if (!comment) return jsonError("Comment body is required.");

  await connectDb();
  const board = await findAccessibleBoard(id, userId);
  if (!board) return jsonError("Board not found.", 404);

  const task = await Task.findOneAndUpdate(
    { _id: taskId, board: id },
    {
      $push: {
        comments: { user: userId, body: comment },
        activity: { user: userId, action: "comment", detail: "Comment added" }
      }
    },
    { new: true }
  );
  if (!task) return jsonError("Task not found.", 404);

  if (task.assignees?.length) {
    await Notification.insertMany(
      task.assignees.map((assignee: string) => ({
        user: assignee,
        task: task._id,
        board: id,
        message: `New comment on ${task.title}.`
      }))
    );
  }

  return NextResponse.json({ task: serializeDoc(task) });
}
