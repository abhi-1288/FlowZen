import { GridFSBucket } from "mongodb";
import { NextResponse } from "next/server";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { findAccessibleBoard } from "@/lib/board-access";
import { connectDb } from "@/lib/db";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data.");
  }

  const boardId = String(formData.get("boardId") ?? "").trim();
  const file = formData.get("file");
  if (!boardId) return jsonError("boardId is required.");
  if (!isObjectId(boardId)) return jsonError("Invalid board id.");
  if (!(file instanceof File)) return jsonError("Attachment file is required.");
  if (file.size <= 0) return jsonError("Attachment file is empty.");
  if (file.size > MAX_SIZE_BYTES) return jsonError("Attachment must be 20MB or smaller.");

  let connection;
  try {
    connection = await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const board = await findAccessibleBoard(boardId, userId);
  if (!board) return jsonError("Board not found.", 404);

  const db = connection.connection.db;
  if (!db) return jsonError("Database connection is not ready.", 500);

  const bucket = new GridFSBucket(db, { bucketName: "taskAttachments" });
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = bucket.openUploadStream(file.name, {
    contentType: file.type || "application/octet-stream",
    metadata: {
      boardId,
      uploadedBy: userId,
      originalName: file.name,
    },
  });

  await new Promise<void>((resolve, reject) => {
    upload.end(bytes, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const fileId = String(upload.id);

  return NextResponse.json({
    id: fileId,
    name: file.name,
    url: `/api/boards/attachments/${fileId}`,
  });
}
