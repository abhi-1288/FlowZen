import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { ATSInterview } from "@/models/ATSInterview";

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (String(actor.role) === "employee") return jsonError("Forbidden.", 403);
  if (String(actor.role) === "security" && !Boolean((actor as any).isSeniorSecurity)) return jsonError("Forbidden.", 403);

  const body = await request.json();
  const interviewId = String(body.interviewId ?? "");
  if (!interviewId || !isObjectId(interviewId)) return jsonError("Interview is required.", 400);

  const interview = await ATSInterview.findOne({
    _id: interviewId,
    company: actor.company,
    location: { $ne: "" },
  });
  if (!interview) return jsonError("Interview not found.", 404);

  const validFrom = body.validFrom ? new Date(String(body.validFrom)) : null;
  const validUntil = body.validUntil ? new Date(String(body.validUntil)) : null;
  if ((validFrom && Number.isNaN(validFrom.getTime())) || (validUntil && Number.isNaN(validUntil.getTime()))) {
    return jsonError("Invalid window.", 400);
  }
  if (validFrom && validUntil && validUntil.getTime() <= validFrom.getTime()) {
    return jsonError("Valid until must be after valid from.", 400);
  }

  await ATSInterview.updateOne(
    { _id: interview._id },
    { $set: { passValidFrom: validFrom, passValidUntil: validUntil } }
  );

  return NextResponse.json({ success: true });
}