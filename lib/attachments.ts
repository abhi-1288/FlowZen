import { promises as fs } from "fs";
import path from "path";
import { GridFSBucket, ObjectId } from "mongodb";
import { connectDb } from "@/lib/db";

export async function deleteAttachments(attachments: { id: string; url: string }[]) {
  if (attachments.length === 0) return;

  const gridIds = attachments
    .map((attachment) => attachment.id)
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  if (gridIds.length > 0) {
    try {
      const connection = await connectDb();
      const db = connection.connection.db;
      if (db) {
        const bucket = new GridFSBucket(db, { bucketName: "taskAttachments" });
        await Promise.all(
          gridIds.map((id) =>
            bucket.delete(id).catch((error) => {
              console.error("Failed to delete GridFS attachment", String(id), error);
            }),
          ),
        );
      }
    } catch (error) {
      console.error("Failed to delete GridFS attachments", error);
    }
  }

  await Promise.all(
    attachments
      .filter((attachment) => attachment.url.startsWith("/uploads/task-attachments/"))
      .map(async (attachment) => {
        try {
          const relativePath = attachment.url.slice(1).split("?")[0];
          const absolutePath = path.join(process.cwd(), "public", relativePath);
          await fs.unlink(absolutePath);
        } catch (error) {
          console.error("Failed to delete local attachment", attachment.url);
        }
      }),
  );
}
