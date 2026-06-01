import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { findAccessibleBoard } from "@/lib/board-access";
import { connectDb } from "@/lib/db";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const SAFE_EXTENSION_PATTERN = /^[a-z0-9]{1,12}$/i;

export const runtime = "nodejs";

function extensionFromName(fileName: string) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  return SAFE_EXTENSION_PATTERN.test(extension) ? extension : "bin";
}

function hasUploadThingConfig() {
  return Boolean(process.env.UPLOADTHING_TOKEN);
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

  const boardId = String(formData.get("boardId") ?? "").trim();
  const file = formData.get("file");
  if (!boardId) return jsonError("boardId is required.");
  if (!isObjectId(boardId)) return jsonError("Invalid board id.");
  if (!(file instanceof File)) return jsonError("Attachment file is required.");
  if (file.size <= 0) return jsonError("Attachment file is empty.");
  if (file.size > MAX_SIZE_BYTES) return jsonError("Attachment must be 20MB or smaller.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const board = await findAccessibleBoard(boardId, userId);
  if (!board) return jsonError("Board not found.", 404);

  const extension = extensionFromName(file.name);
  const fileName = `${boardId}-${randomUUID()}.${extension}`;

  if (hasUploadThingConfig()) {
    const renamedFile = new File([file], fileName, {
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified,
    });
    const utapi = new UTApi();
    try {
      const response = await utapi.uploadFiles(renamedFile);
      if (response.error) {
        return jsonError(`UploadThing error: ${response.error.message}`, 500);
      }

      return NextResponse.json({
        id: response.data.key,
        name: file.name,
        url: response.data.ufsUrl || response.data.url,
      });
    } catch {
      return jsonError("Failed to upload attachment to UploadThing.", 500);
    }
  }

  if (process.env.NODE_ENV === "production") {
    return jsonError("UPLOADTHING_TOKEN is required for production attachment uploads.", 500);
  }

  const bytes = await file.arrayBuffer();
  const relativeDir = path.join("uploads", "task-attachments");
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  const absolutePath = path.join(absoluteDir, fileName);

  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(bytes));

  return NextResponse.json({
    id: randomUUID(),
    name: file.name,
    url: `/${relativeDir.replaceAll("\\", "/")}/${fileName}`,
  });
}
