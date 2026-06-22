import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const runtime = "nodejs";

function hasUploadThingConfig() {
  return process.env.NODE_ENV === "production" && Boolean(process.env.UPLOADTHING_TOKEN);
}

async function getCompany(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");
  if (user.role !== "admin") throw new Error("Only admins can update company icon.");
  if (!user.company) throw new Error("You must have a registered company.");

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const company = await Company.findById(companyId);
  if (!company) throw new Error("Company not found.");
  return company;
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

  const file = formData.get("icon");
  if (!(file instanceof File)) return jsonError("Company icon file is required.");
  if (!ALLOWED_TYPES.has(file.type)) return jsonError("Only PNG, JPG, and WEBP images are allowed.");
  if (file.size > MAX_SIZE_BYTES) return jsonError("Icon must be 2MB or smaller.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  let company: any;
  try {
    company = await getCompany(userId);
  } catch (err: any) {
    return jsonError(err.message, 400);
  }

  let nextIconUrl = "";

  if (hasUploadThingConfig()) {
    const utapi = new UTApi();
    try {
      const response = await utapi.uploadFiles(file);
      if (response.error) {
        return jsonError(`UploadThing error: ${response.error.message}`, 500);
      }
      nextIconUrl = response.data.url;
    } catch {
      return jsonError("Failed to upload icon to UploadThing.", 500);
    }
  } else {
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const fileName = `company-${company._id}-${randomUUID()}.${extension}`;
    const relativeDir = path.join("uploads", "avatars");
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    const absolutePath = path.join(absoluteDir, fileName);

    await fs.mkdir(absoluteDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(bytes));

    nextIconUrl = `/${relativeDir.replaceAll("\\", "/")}/${fileName}`;
  }

  company.icon = nextIconUrl;
  await company.save();

  return NextResponse.json({ icon: nextIconUrl });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  let company: any;
  try {
    company = await getCompany(userId);
  } catch (err: any) {
    return jsonError(err.message, 400);
  }

  const currentIcon = company.icon ?? "";
  if (!currentIcon) {
    return jsonError("No company icon to delete.", 400);
  }

  if (!currentIcon.startsWith("/uploads/")) {
    if (hasUploadThingConfig() || Boolean(process.env.UPLOADTHING_TOKEN)) {
      const utapi = new UTApi();
      try {
        const urlObj = new URL(currentIcon);
        const key = urlObj.pathname.split("/").pop();
        if (key) {
          await utapi.deleteFiles(key);
        }
      } catch (error) {
        console.error("Failed to delete company icon from UploadThing:", error);
      }
    }
  } else {
    try {
      const relativePath = currentIcon.slice(1).split("?")[0];
      const absolutePath = path.join(process.cwd(), "public", relativePath);
      await fs.unlink(absolutePath);
    } catch {
      console.error("Failed to delete local company icon file:", currentIcon);
    }
  }

  company.icon = "";
  await company.save();

  return NextResponse.json({ icon: "" });
}
