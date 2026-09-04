import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { createItJoiningCode } from "@/lib/codes";
import { Company } from "@/models/Company";
import { ITJoiningCode } from "@/models/ITJoiningCode";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_EXPIRY_HOURS = 168;

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

  const actor = await User.findById(userId).select("role company companyStatus name isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to view IT joining codes.", 403);
  }
  const isItAdmin =
    String(actor.role) === "it-admin" ||
    String(actor.role) === "admin" ||
    (String(actor.role) === "human-resource" && Boolean(actor.isSeniorSecurity));
  if (!isItAdmin) {
    return jsonError("Only IT admins can manage IT joining codes.", 403);
  }

  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;

  const codes = await ITJoiningCode.find({ company: companyId }).sort({ createdAt: -1 });

  return NextResponse.json({ codes: codes.map(serializeDoc) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const role = String(body.role ?? "").trim().toLowerCase();
  if (role && role !== "it-administration") {
    return jsonError("IT joining codes can only be generated for the IT Administration role.", 403);
  }

  const hours = Math.max(1, Math.min(Number(body.expiresInHours ?? 24), MAX_EXPIRY_HOURS));
  const maxUses = Math.max(1, Math.min(Number(body.maxUses ?? 1), 100));

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("role company companyStatus name isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to generate IT joining codes.", 403);
  }
  const isItAdmin =
    String(actor.role) === "it-admin" ||
    String(actor.role) === "admin" ||
    (String(actor.role) === "human-resource" && Boolean(actor.isSeniorSecurity));
  if (!isItAdmin) {
    return jsonError("Only IT admins can generate IT joining codes.", 403);
  }

  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;
  const companyName = String((actor.company as any)?.name ?? "");

  let code = "";
  let attempts = 0;
  while (attempts < 10) {
    code = createItJoiningCode();
    const existing = await ITJoiningCode.findOne({ code });
    if (!existing) break;
    attempts += 1;
  }

  const joinCode = await ITJoiningCode.create({
    code,
    createdBy: userId,
    company: companyId,
    intendedRole: "it-administration",
    organization: "IT Team",
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    maxUses,
    usedCount: 0,
    status: "active",
  });

  await Notification.create({
    user: userId,
    company: companyId,
    type: "info",
    title: "IT joining code generated",
    message: `Generated IT joining code ${code} (expires in ${hours}h, ${maxUses} use(s)).`,
  });

  return NextResponse.json({ code: serializeDoc(joinCode), companyName }, { status: 201 });
}
