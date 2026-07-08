import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";

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

  const actor = await User.findById(userId).select("company role companyStatus isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (String(actor.role) === "employee") return jsonError("Forbidden.", 403);
  if (String(actor.role) === "security" && !Boolean((actor as any).isSeniorSecurity)) return jsonError("Forbidden.", 403);

  type PassDoc = Record<string, unknown>;
  const passes = await VisitorPass.find({ company: actor.company })
    .sort({ createdAt: -1 })
    .lean() as PassDoc[];

  const now = new Date();
  for (const pass of passes) {
    if (
      String(pass.status) === "approved" &&
      pass.validUntil &&
      new Date(String(pass.validUntil)) < now
    ) {
      await VisitorPass.updateOne({ _id: pass._id }, { $set: { status: "expired" } });
      pass.status = "expired";
    }
  }

  return NextResponse.json({ passes });
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

  const actor = await User.findById(userId).select("company role companyStatus name isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (String(actor.role) === "employee") return jsonError("Forbidden.", 403);
  if (String(actor.role) === "security" && !Boolean((actor as any).isSeniorSecurity)) return jsonError("Forbidden.", 403);

  const body = await request.json();

  const timeIn = body.timeIn ? new Date(String(body.timeIn)) : null;
  const timeOut = body.timeOut ? new Date(String(body.timeOut)) : null;

  const pass = await VisitorPass.create({
    createdBy: userId,
    company: actor.company,
    visitorName: String(body.visitorName ?? "").trim(),
    visitorEmail: String(body.visitorEmail ?? "").trim().toLowerCase(),
    visitorPhone: String(body.visitorPhone ?? "").trim(),
    visitorCompany: String(body.visitorCompany ?? "").trim(),
    region: String(body.region ?? "").trim(),
    purpose: String(body.purpose ?? "").trim(),
    identityCode: null,
    timeIn,
    timeOut,
    status: "pending",
  });

  return NextResponse.json({ pass: { ...pass.toObject(), id: String(pass._id) } });
}
