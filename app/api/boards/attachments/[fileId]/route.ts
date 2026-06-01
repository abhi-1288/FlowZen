import { Readable } from "stream";
import { GridFSBucket, ObjectId } from "mongodb";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { findAccessibleBoard } from "@/lib/board-access";
import { connectDb } from "@/lib/db";

type Params = { params: Promise<{ fileId: string }> };

export const runtime = "nodejs";

function contentDisposition(name: string) {
  const fallback = name.replace(/[^\w.-]+/g, "_") || "attachment";
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(_request: Request, { params }: Params) {
  const { fileId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!ObjectId.isValid(fileId)) return jsonError("Invalid attachment id.");

  let connection;
  try {
    connection = await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const db = connection.connection.db;
  if (!db) return jsonError("Database connection is not ready.", 500);

  const bucket = new GridFSBucket(db, { bucketName: "taskAttachments" });
  const id = new ObjectId(fileId);
  const file = await bucket.find({ _id: id }).next();
  if (!file) return jsonError("Attachment not found.", 404);

  const boardId = String(file.metadata?.boardId ?? "");
  if (!boardId) return jsonError("Attachment is missing board metadata.", 404);

  const board = await findAccessibleBoard(boardId, userId);
  if (!board) return jsonError("Board not found.", 404);

  const stream = bucket.openDownloadStream(id);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": file.contentType || "application/octet-stream",
      "Content-Disposition": contentDisposition(String(file.metadata?.originalName || file.filename)),
      "Cache-Control": "private, max-age=300",
    },
  });
}
