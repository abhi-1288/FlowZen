import { promises as fs } from "fs";
import path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const SUBDIR = "documents";

function hasR2Config() {
  return Boolean(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

let s3Client: S3Client | null = null;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export async function saveDocument(
  file: File,
  key: string,
): Promise<{ url: string; fileName: string; fileType: string; fileSize: number }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name;
  const fileType = file.type;
  const fileSize = buffer.length;

  if (process.env.NODE_ENV === "production" && hasR2Config()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: `${SUBDIR}/${key}`,
        Body: buffer,
        ContentType: fileType,
      }),
    );
    const url = `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${SUBDIR}/${key}`;
    return { url, fileName, fileType, fileSize };
  }

  const dir = path.join(process.cwd(), "public", "uploads", SUBDIR);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, key);
  await fs.writeFile(filePath, buffer);
  const url = `/uploads/${SUBDIR}/${key}`;
  return { url, fileName, fileType, fileSize };
}

export async function deleteDocument(key: string) {
  if (process.env.NODE_ENV === "production" && hasR2Config()) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: `${SUBDIR}/${key}`,
      }),
    );
    return;
  }

  const filePath = path.join(process.cwd(), "public", "uploads", SUBDIR, key);
  try {
    await fs.unlink(filePath);
  } catch {
    // file may not exist
  }
}
