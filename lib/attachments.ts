import { promises as fs } from "fs";
import path from "path";
import ImageKit from "imagekit";

function hasImageKitConfig() {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT,
  );
}

export async function deleteAttachments(attachments: { id: string; url: string }[]) {
  if (attachments.length === 0) return;

  const imageKitAttachments = attachments.filter(
    (attachment) =>
      attachment.id &&
      !attachment.url.startsWith("/uploads/task-attachments/") &&
      !attachment.url.startsWith("/api/boards/attachments/"),
  );

  if (imageKitAttachments.length > 0 && hasImageKitConfig()) {
    const imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    });

    try {
      await imagekit.bulkDeleteFiles(imageKitAttachments.map((attachment) => attachment.id));
    } catch (error) {
      console.error("Failed to delete attachments from ImageKit", error);
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
        } catch {
          console.error("Failed to delete local attachment", attachment.url);
        }
      }),
  );
}
