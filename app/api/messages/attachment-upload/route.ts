import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { requireUserId, jsonError } from "@/lib/api";
import { isImageKitMode } from "@/lib/message-attachments";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 200 * 1024 * 1024;
const SAFE_EXT_PATTERN = /^[a-z0-9]{1,12}$/i;
const UPLOAD_DIR = "uploads/message-attachments";

function extensionFromName(fileName: string) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  return SAFE_EXT_PATTERN.test(ext) ? ext : "bin";
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  if (isImageKitMode()) {
    return jsonError("Use ImageKit direct upload in production.", 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("file is required.");
  if (file.size <= 0) return jsonError("File is empty.");
  if (file.size > MAX_SIZE_BYTES) return jsonError("File must be 200MB or smaller.");

  const extension = extensionFromName(file.name);
  const fileId = `${randomUUID()}.${extension}`;
  const absoluteDir = path.join(process.cwd(), "public", UPLOAD_DIR);
  const absolutePath = path.join(absoluteDir, fileId);

  const bytes = await file.arrayBuffer();
  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(bytes));

  return NextResponse.json({
    fileId,
    name: file.name,
    url: `/${UPLOAD_DIR}/${fileId}`,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  });
}
