import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { createHmac } from "crypto";

const UPLOAD_DIR = "uploads/message-attachments";

export function isImageKitMode() {
  return (
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.IMAGEKIT_PUBLIC_KEY) &&
    Boolean(process.env.IMAGEKIT_PRIVATE_KEY) &&
    Boolean(process.env.IMAGEKIT_URL_ENDPOINT) &&
    Boolean(process.env.IMAGEKIT_ID)
  );
}

export function computeExpiresAt() {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  return d;
}

export function deriveKind(mimeType: string): "image" | "video" | "file" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

export function generateUploadSignature() {
  const token = randomUUID().replace(/-/g, "").slice(0, 20);
  const expire = Math.floor(Date.now() / 1000) + 1800;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY!;
  const signature = createHmac("sha1", privateKey).update(token + expire).digest("hex");
  return {
    provider: "imagekit" as const,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    token,
    expire,
    signature,
  };
}

export function generateLocalUploadSignature() {
  return { provider: "local" as const };
}

const SAFE_EXT_PATTERN = /^[a-z0-9]{1,12}$/i;

function extensionFromName(fileName: string) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  return SAFE_EXT_PATTERN.test(ext) ? ext : "bin";
}

export async function saveLocalFile(
  file: File,
  fileName: string
): Promise<{ fileId: string; name: string; url: string; size: number; mimeType: string }> {
  const extension = extensionFromName(fileName);
  const fileId = `${randomUUID()}.${extension}`;
  const absoluteDir = path.join(process.cwd(), "public", UPLOAD_DIR);
  const absolutePath = path.join(absoluteDir, fileId);

  const bytes = await file.arrayBuffer();
  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(bytes));

  return {
    fileId,
    name: fileName,
    url: `/${UPLOAD_DIR}/${fileId}`,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function deleteMessageAttachment(attachment: {
  provider: string;
  fileId: string;
  url: string;
}) {
  if (attachment.provider === "imagekit" && attachment.fileId) {
    try {
      const credentials = Buffer.from(
        `${process.env.IMAGEKIT_PRIVATE_KEY}:`
      ).toString("base64");
      await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(attachment.fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Basic ${credentials}` },
      });
    } catch {
      console.error("Failed to delete ImageKit file:", attachment.fileId);
    }
    return;
  }

  if (attachment.provider === "local" && attachment.url) {
    try {
      const relativePath = attachment.url.replace(/^\/+/, "");
      const absolutePath = path.join(process.cwd(), "public", relativePath);
      await fs.unlink(absolutePath);
    } catch {
      console.error("Failed to delete local message attachment:", attachment.url);
    }
  }
}
