import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { Meeting } from "@/models/Meeting";
import { User } from "@/models/User";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  await connectDb();

  const actor = await User.findById(userId).select("role company");
  if (!actor || !actor.company)
    return jsonError("Access denied.", 403);

  const meeting = await Meeting.findById(id);
  if (!meeting) return jsonError("Meeting not found.", 404);
  if (String(meeting.company) !== String(actor.company))
    return jsonError("Access denied.", 403);

  const body = await _request.json();
  if (body.action === "cancel") {
    meeting.status = "cancelled";
    await meeting.save();
    return NextResponse.json({ status: "cancelled" });
  }

  return jsonError("Invalid action.", 400);
}
