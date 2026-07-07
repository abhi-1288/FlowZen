import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { VisitorEvent } from "@/models/VisitorEvent";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role");
  if (!actor) return jsonError("User not found.", 404);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;
  type AnyDoc = Record<string, unknown>;
  const event = await VisitorEvent.findOne({ _id: id, company: actor.company }).lean() as AnyDoc | null;
  if (!event) return jsonError("Not found.", 404);

  return NextResponse.json({ event: { ...event, id: String(event._id) } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role");
  if (!actor) return jsonError("User not found.", 404);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.visitorCompany !== undefined) updates.visitorCompany = String(body.visitorCompany).trim();
  if (body.expectedDate !== undefined) updates.expectedDate = body.expectedDate ? new Date(body.expectedDate) : null;
  if (body.purpose !== undefined) updates.purpose = String(body.purpose).trim();
  if (body.hostName !== undefined) updates.hostName = String(body.hostName).trim();
  if (body.hostEmail !== undefined) updates.hostEmail = String(body.hostEmail).trim();
  if (body.notes !== undefined) updates.notes = String(body.notes).trim();
  if (body.status !== undefined) updates.status = body.status;

  type AnyDoc = Record<string, unknown>;
  const event = await VisitorEvent.findOneAndUpdate(
    { _id: id, company: actor.company },
    { $set: updates },
    { new: true }
  ).lean() as AnyDoc | null;

  if (!event) return jsonError("Not found.", 404);

  return NextResponse.json({ event: { ...event, id: String(event._id) } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role");
  if (!actor) return jsonError("User not found.", 404);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;

  type AnyDoc = Record<string, unknown>;
  const event = await VisitorEvent.findOneAndDelete({ _id: id, company: actor.company }).lean() as AnyDoc | null;
  if (!event) return jsonError("Not found.", 404);

  return NextResponse.json({ success: true });
}
