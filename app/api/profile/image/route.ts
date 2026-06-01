import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const runtime = "nodejs";

function hasUploadThingConfig() {
  return process.env.NODE_ENV === "production" && Boolean(process.env.UPLOADTHING_TOKEN);
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

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);

  let nextAvatarUrl = "";

  if (hasUploadThingConfig()) {
    const utapi = new UTApi();
    try {
      const response = await utapi.uploadFiles(file);
      if (response.error) {
        return jsonError(`UploadThing error: ${response.error.message}`, 500);
      }
      nextAvatarUrl = response.data.url;
    } catch {
      return jsonError("Failed to upload avatar to UploadThing.", 500);
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      return jsonError("UPLOADTHING_TOKEN is required for production avatar uploads.", 500);
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const fileName = `${userId}-${randomUUID()}.${extension}`;
    const relativeDir = path.join("uploads", "avatars");
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    const absolutePath = path.join(absoluteDir, fileName);

    await fs.mkdir(absoluteDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(bytes));

    nextAvatarUrl = `/${relativeDir.replaceAll("\\", "/")}/${fileName}`;
  }

  user.avatarUrl = nextAvatarUrl;
  await user.save();

  return NextResponse.json({ avatarUrl: nextAvatarUrl });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);

  const currentUrl = user.avatarUrl ?? "";
  if (!currentUrl) {
    return jsonError("No avatar to delete.", 400);
  }

  // Delete from UploadThing if it's a remote URL
  if (!currentUrl.startsWith("/uploads/")) {
    if (hasUploadThingConfig() || Boolean(process.env.UPLOADTHING_TOKEN)) {
      const utapi = new UTApi();
      try {
        // UploadThing URLs contain the file key in the path
        const urlObj = new URL(currentUrl);
        const key = urlObj.pathname.split("/").pop();
        if (key) {
          await utapi.deleteFiles(key);
        }
      } catch (error) {
        console.error("Failed to delete avatar from UploadThing:", error);
      }
    }
  } else {
    // Delete from local filesystem
    try {
      const relativePath = currentUrl.slice(1).split("?")[0];
      const absolutePath = path.join(process.cwd(), "public", relativePath);
      await fs.unlink(absolutePath);
    } catch {
      console.error("Failed to delete local avatar file:", currentUrl);
    }
  }

  user.avatarUrl = "";
  await user.save();

  return NextResponse.json({ avatarUrl: "" });
}
