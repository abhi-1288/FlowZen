import { promises as fs } from "fs";
import path from "path";
import { UTApi } from "uploadthing/server";

function hasUploadThingConfig() {
  return Boolean(process.env.UPLOADTHING_TOKEN);
}

export async function deleteAttachments(attachments: { id: string; url: string }[]) {
  if (attachments.length === 0) return;

  const uploadThingAttachments = attachments.filter(
    (attachment) =>
      attachment.id &&
      !attachment.url.startsWith("/uploads/task-attachments/") &&
      !attachment.url.startsWith("/api/boards/attachments/"),
  );

  if (uploadThingAttachments.length > 0 && hasUploadThingConfig()) {
    const utapi = new UTApi();
    try {
      await utapi.deleteFiles(uploadThingAttachments.map((attachment) => attachment.id));
    } catch (error) {
      console.error("Failed to delete attachments from UploadThing", error);
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
