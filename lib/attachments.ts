import ImageKit from "imagekit";
import { promises as fs } from "fs";
import path from "path";

export async function deleteAttachments(attachments: { id: string; url: string }[]) {
  if (attachments.length === 0) return;

  if (process.env.NODE_ENV === "production") {
    const imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    });
    const fileIds = attachments.map(a => a.id);
    try {
      await imagekit.bulkDeleteFiles(fileIds);
    } catch (error) {
      console.error("Failed to delete attachments from ImageKit", error);
    }
  } else {
    for (const attachment of attachments) {
      if (attachment.url.startsWith("/uploads/task-attachments/")) {
        try {
          const relativePath = attachment.url.slice(1).split("?")[0];
          const absolutePath = path.join(process.cwd(), "public", relativePath);
          await fs.unlink(absolutePath);
        } catch (error) {
          console.error("Failed to delete local attachment", attachment.url);
        }
      }
    }
  }
}
