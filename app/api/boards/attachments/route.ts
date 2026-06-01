import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { findAccessibleBoard } from "@/lib/board-access";
import { connectDb } from "@/lib/db";
import ImageKit from "imagekit";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const SAFE_EXTENSION_PATTERN = /^[a-z0-9]{1,12}$/i;

function extensionFromName(fileName: string) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  return SAFE_EXTENSION_PATTERN.test(extension) ? extension : "bin";
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

  let fileId = "";
  let fileUrl = "";

  if (process.env.NODE_ENV === "production") {
    const imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    });

    try {
      const bytes = await file.arrayBuffer();
      const extension = extensionFromName(file.name);
      const fileName = `${boardId}-${randomUUID()}.${extension}`;
      const response = await imagekit.upload({
        file: Buffer.from(bytes),
        fileName,
        folder: "/task-attachments",
      });
      fileId = response.fileId;
      fileUrl = response.url;
    } catch (err) {
      return jsonError("Failed to upload attachment to cloud.");
    }
  } else {
    const extension = extensionFromName(file.name);
    const fileName = `${boardId}-${randomUUID()}.${extension}`;
    const relativeDir = path.join("uploads", "task-attachments");
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    const absolutePath = path.join(absoluteDir, fileName);

    await fs.mkdir(absoluteDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(bytes));

    fileId = randomUUID();
    fileUrl = `/${relativeDir.replaceAll("\\", "/")}/${fileName}`;
  }

  return NextResponse.json({
    id: fileId,
    name: file.name,
    url: fileUrl,
  });
}
