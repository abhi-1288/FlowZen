import { GridFSBucket, ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const runtime = "nodejs";

function avatarIdFromUrl(url: string) {
  const match = url.match(/\/api\/profile\/image\/([a-f\d]{24})/i);
  return match?.[1] ?? "";
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data.");
  }

  const file = formData.get("avatar");
  if (!(file instanceof File)) return jsonError("Avatar file is required.");
  if (!ALLOWED_TYPES.has(file.type)) return jsonError("Only PNG, JPG, and WEBP images are allowed.");
  if (file.size > MAX_SIZE_BYTES) return jsonError("Avatar must be 2MB or smaller.");

  let connection;
  try {
    connection = await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);

  const db = connection.connection.db;
  if (!db) return jsonError("Database connection is not ready.", 500);

  const bucket = new GridFSBucket(db, { bucketName: "avatars" });
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = bucket.openUploadStream(file.name, {
    contentType: file.type,
    metadata: {
      userId,
      originalName: file.name,
    },
  });

  await new Promise<void>((resolve, reject) => {
    upload.end(bytes, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const previousAvatarId = avatarIdFromUrl(String(user.avatarUrl ?? ""));
  user.avatarUrl = `/api/profile/image/${String(upload.id)}`;
  await user.save();

  if (ObjectId.isValid(previousAvatarId)) {
    await bucket.delete(new ObjectId(previousAvatarId)).catch(() => {});
  }

  return NextResponse.json({ avatarUrl: user.avatarUrl });
}
