import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { jsonError } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() || "";
  if (!email) return jsonError("Email is required.", 400);

  await connectDb();
  const { id } = await params;

  const existing = await ATSCandidate.findOne({ job: id, email }).select("firstName lastName stage").lean();
  if (!existing) return NextResponse.json({ exists: false, candidate: null });

  return NextResponse.json({
    exists: true,
    candidate: { firstName: existing.firstName, lastName: existing.lastName, stage: existing.stage },
  });
}