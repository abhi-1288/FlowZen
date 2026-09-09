import { NextResponse } from "next/server";
import { requireUserId, jsonError } from "@/lib/api";
import { isImageKitMode, generateUploadSignature, generateLocalUploadSignature } from "@/lib/message-attachments";

export const runtime = "nodejs";

async function handle() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  if (isImageKitMode()) {
    return NextResponse.json(generateUploadSignature());
  }

  return NextResponse.json(generateLocalUploadSignature());
}

export async function POST(_request: Request) {
  return handle();
}

export async function GET() {
  return handle();
}