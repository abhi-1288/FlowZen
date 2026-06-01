import { Readable } from "stream";
import { GridFSBucket, ObjectId } from "mongodb";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { connectDb } from "@/lib/db";

type Params = { params: Promise<{ imageId: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: Params) {
  const { imageId } = await params;
  if (!ObjectId.isValid(imageId)) return jsonError("Invalid image id.");

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

  const bucket = new GridFSBucket(db, { bucketName: "avatars" });
  const id = new ObjectId(imageId);
  const file = await bucket.find({ _id: id }).next();
  if (!file) return jsonError("Image not found.", 404);

  const contentType = String(file.contentType || "");
  if (!contentType.startsWith("image/")) return jsonError("File is not an image.", 415);

  const stream = bucket.openDownloadStream(id);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
