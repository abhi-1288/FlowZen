import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

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

  const companyDoc = await Company.findById(actor.company).select("name").lean() as Record<string, unknown> | null;
  const companyName = companyDoc?.name ? String(companyDoc.name) : "";

  const pass = await VisitorPass.create({
    createdBy: userId,
    company: actor.company,
    visitorName: String(body.visitorName ?? "").trim(),
    visitorEmail: String(body.visitorEmail ?? "").trim().toLowerCase(),
    visitorPhone: String(body.visitorPhone ?? "").trim(),
    visitorCompany: companyName,
    hostName: actor.name ?? "",
    region: String(body.region ?? "").trim(),
    purpose: String(body.purpose ?? "").trim(),
    timeIn,
    timeOut,
    status: "pending",
  });

  // Notify all admin/HR users in the company to review the pending pass
  const approvers = await User.find({ company: actor.company, role: { $in: ["admin", "human-resource"] } }).select("_id").lean();
  for (const approver of approvers) {
    const notif = await Notification.create({
      user: approver._id,
      company: actor.company,
      type: "approval",
      title: "Visitor Pass Pending Approval",
      message: `${actor.name ?? "Someone"} requested a visitor pass for ${pass.visitorName}.`,
      body: `Visitor: ${pass.visitorName}\nEmail: ${pass.visitorEmail}\nRegion: ${pass.region || "N/A"}\nTime In: ${timeIn ? timeIn.toLocaleString("en-IN") : "N/A"}\nTime Out: ${timeOut ? timeOut.toLocaleString("en-IN") : "N/A"}\nPurpose: ${pass.purpose || "N/A"}`,
      link: "/profile/visitors",
    });
    emitNotification(String(approver._id));
  }

  return NextResponse.json({ pass: { ...pass.toObject(), id: String(pass._id) } });
}
