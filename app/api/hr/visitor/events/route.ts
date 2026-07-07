import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { VisitorEvent } from "@/models/VisitorEvent";

function generateSlug(): string {
  return crypto.randomBytes(6).toString("hex");
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const events = await VisitorEvent.find({ company: actor.company })
    .sort({ createdAt: -1 })
    .lean() as Record<string, unknown>[];

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("name company role companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const body = await request.json();

  const slug = generateSlug();
  const event = await VisitorEvent.create({
    company: actor.company,
    createdBy: userId,
    slug,
    visitorCompany: String(body.visitorCompany ?? "").trim(),
    expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
    purpose: String(body.purpose ?? "").trim(),
    hostName: String(body.hostName ?? "").trim(),
    hostEmail: String(body.hostEmail ?? "").trim(),
    notes: String(body.notes ?? "").trim(),
    status: "upcoming",
  });

  return NextResponse.json({ event: { ...event.toObject(), id: String(event._id) } });
}
