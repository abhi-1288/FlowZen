import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { VisitorEvent } from "@/models/VisitorEvent";

type AnyDoc = Record<string, unknown>;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const { slug } = await params;
  const event = await VisitorEvent.findOne({ slug }).populate("company", "name icon addresses multiOffice address").lean() as AnyDoc | null;

  if (!event) return jsonError("Not found.", 404);

  return NextResponse.json({ event: { ...event, id: String(event._id) } });
}
