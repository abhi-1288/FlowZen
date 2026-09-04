import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { deleteAttachments } from "@/lib/attachments";
import { ITTicket } from "@/models/ITTicket";
import { User } from "@/models/User";
import { canViewTicket, pushItActivity } from "@/lib/it";

type Params = { params: Promise<{ id: string }> };

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const SAFE_EXTENSION_PATTERN = /^[a-z0-9]{1,12}$/i;
export const runtime = "nodejs";

function extensionFromName(fileName: string) {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  return SAFE_EXTENSION_PATTERN.test(extension) ? extension : "bin";
}

function hasUploadThingConfig() {
  return process.env.NODE_ENV === "production" && Boolean(process.env.UPLOADTHING_TOKEN);
}

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, ticket] = await Promise.all([
    User.findById(userId).select("role company companyStatus name"),
    ITTicket.findById(id),
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!ticket) return jsonError("Ticket not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to add IT ticket attachments.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const allowed = await canViewTicket({ role: String(user.role), _id: user._id }, companyId, ticket);
  if (!allowed) return jsonError("You do not have permission to add attachments to this ticket.", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data.");
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("Attachment file is required.");
  if (file.size <= 0) return jsonError("Attachment file is empty.");
  if (file.size > MAX_SIZE_BYTES) return jsonError("Attachment must be 20MB or smaller.");

  const extension = extensionFromName(file.name);
  const fileName = `it-${id}-${randomUUID()}.${extension}`;

  let attachment: { id: string; name: string; url: string };
  if (hasUploadThingConfig()) {
    const renamedFile = new File([file], fileName, {
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified,
    });
    const utapi = new UTApi();
    try {
      const response = await utapi.uploadFiles(renamedFile);
      if (response.error) return jsonError(`UploadThing error: ${response.error.message}`, 500);
      attachment = { id: response.data.key, name: file.name, url: response.data.ufsUrl || response.data.url };
    } catch {
      return jsonError("Failed to upload attachment to UploadThing.", 500);
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      return jsonError("UPLOADTHING_TOKEN is required for production attachment uploads.", 500);
    }
    const bytes = await file.arrayBuffer();
    const relativeDir = path.join("uploads", "it-attachments");
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    const absolutePath = path.join(absoluteDir, fileName);
    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from(bytes));
    attachment = { id: randomUUID(), name: file.name, url: `/${relativeDir.replaceAll("\\", "/")}/${fileName}` };
  }

  if (!Array.isArray(ticket.attachments)) ticket.attachments = [];
  ticket.attachments.push(attachment);
  pushItActivity(ticket, { _id: user._id }, "Attachment added", `Attachment "${file.name}" added`);
  await ticket.save();

  const refreshed = await ITTicket.findById(id);
  return NextResponse.json({ ticket: serializeDoc(refreshed) }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const url = new URL(request.url);
  const attachmentId = String(url.searchParams.get("attachmentId") ?? "").trim();
  if (!isObjectId(id)) return jsonError("Invalid ticket id.", 400);
  if (!attachmentId) return jsonError("attachmentId is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [user, ticket] = await Promise.all([
    User.findById(userId).select("role company companyStatus name"),
    ITTicket.findById(id),
  ]);
  if (!user) return jsonError("User not found.", 404);
  if (!ticket) return jsonError("Ticket not found.", 404);
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const allowed = await canViewTicket({ role: String(user.role), _id: user._id }, companyId, ticket);
  if (!allowed) return jsonError("You do not have permission to remove attachments from this ticket.", 403);

  const index = (ticket.attachments ?? []).findIndex((a: any) => String(a.id) === attachmentId);
  if (index === -1) return jsonError("Attachment not found.", 404);
  const [removed] = ticket.attachments.splice(index, 1);
  pushItActivity(ticket, { _id: user._id }, "Attachment removed", `Attachment "${removed.name}" removed`);
  await ticket.save();
  await deleteAttachments([removed]);

  const refreshed = await ITTicket.findById(id);
  return NextResponse.json({ ticket: serializeDoc(refreshed) });
}
