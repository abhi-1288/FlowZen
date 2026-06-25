import { promises as fs } from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

const SUBDIR = "documents";

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

let configured = false;

function ensureConfig() {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    configured = true;
  }
}

export async function saveDocument(
  file: File,
  key: string,
  subdir = SUBDIR,
): Promise<{ url: string; fileName: string; fileType: string; fileSize: number }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name;
  const fileType = file.type;
  const fileSize = buffer.length;

  if (process.env.NODE_ENV === "production" && hasCloudinaryConfig()) {
    ensureConfig();
    const publicId = `${subdir}/${key.replace(/\.[^.]+$/, "")}`;
    const dataUri = `data:${fileType};base64,${buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      resource_type: "auto",
    });
    return { url: result.secure_url, fileName, fileType, fileSize };
  }

  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, key);
  await fs.writeFile(filePath, buffer);
  const url = `/uploads/${subdir}/${key}`;
  return { url, fileName, fileType, fileSize };
}

export async function deleteDocument(key: string, subdir = SUBDIR) {
  if (process.env.NODE_ENV === "production" && hasCloudinaryConfig()) {
    ensureConfig();
    const publicId = `${subdir}/${key.replace(/\.[^.]+$/, "")}`;
    await cloudinary.uploader.destroy(publicId);
    return;
  }

  const filePath = path.join(process.cwd(), "public", "uploads", subdir, key);
  try {
    await fs.unlink(filePath);
  } catch {
    // file may not exist
  }
}

export async function deleteFileByUrl(url: string) {
  if (!url) return;

  if (url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", url);
    try {
      await fs.unlink(filePath);
    } catch {
      // file may not exist
    }
  } else if (process.env.NODE_ENV === "production" && hasCloudinaryConfig() && url.includes("cloudinary")) {
    ensureConfig();
    try {
      const urlObj = new URL(url);
      const segments = urlObj.pathname.split("/");
      const uploadIdx = segments.findIndex((s) => s === "upload");
      if (uploadIdx !== -1 && uploadIdx + 2 < segments.length) {
        let start = uploadIdx + 1;
        if (segments[start]?.startsWith("v")) start++;
        const publicId = segments.slice(start).join("/").replace(/\.[^.]+$/, "");
        await cloudinary.uploader.destroy(publicId);
      }
    } catch {
      // fail silently
    }
  }
}
