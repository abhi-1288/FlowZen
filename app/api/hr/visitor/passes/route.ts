import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";
import { ATSInterview } from "@/models/ATSInterview";
import { EntryLog } from "@/models/EntryLog";
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

  // Today's in-person candidate interviews also count as visitors for the day.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const interviews = await ATSInterview.find({
    company: actor.company,
    status: { $in: ["scheduled", "cancelled", "completed"] },
    location: { $ne: "" },
    scheduledAt: { $gte: todayStart, $lt: todayEnd },
  })
    .sort({ scheduledAt: 1 })
    .populate("candidate", "firstName lastName email")
    .populate("job", "title")
    .populate("interviewer", "name")
    .lean() as Record<string, unknown>[];

  const candidateIds = interviews
    .map((i) => (i.candidate as any)?._id)
    .filter(Boolean)
    .map(String);

  const todayLogs = (candidateIds.length
    ? await EntryLog.find({
        company: actor.company,
        candidate: { $in: candidateIds },
        timestamp: { $gte: todayStart, $lt: todayEnd },
      }).lean()
    : []
  ) as Record<string, unknown>[];

  const logsByCandidate = new Map<string, Record<string, unknown>[]>();
  for (const log of todayLogs) {
    const cid = String(log.candidate);
    const arr = logsByCandidate.get(cid) ?? [];
    arr.push(log);
    logsByCandidate.set(cid, arr);
  }

  const candidatePasses = interviews.map((i) => {
    const candId = String((i.candidate as any)?._id);
    const logs = (logsByCandidate.get(candId) ?? []).sort(
      (a, b) => new Date(String(a.timestamp)).getTime() - new Date(String(b.timestamp)).getTime()
    );
    const entryTimes = logs.filter((l) => l.type === "entry");
    const exitTimes = logs.filter((l) => l.type === "exit");
    const lastEntryAt = entryTimes.length ? new Date(String(entryTimes[entryTimes.length - 1].timestamp)).getTime() : null;
    const lastExitAt = exitTimes.length ? new Date(String(exitTimes[exitTimes.length - 1].timestamp)).getTime() : null;
    const scanned = lastEntryAt !== null;
    const inPremises = scanned && (lastExitAt === null || lastExitAt < lastEntryAt);

    const scheduledAt = new Date(String(i.scheduledAt));
    const passValidFrom = i.passValidFrom
      ? new Date(String(i.passValidFrom))
      : new Date(scheduledAt.getTime() - 15 * 60 * 1000);
    const passValidUntil = i.passValidUntil
      ? new Date(String(i.passValidUntil))
      : new Date(scheduledAt.getTime() + 15 * 60 * 1000);

    let status: string;
    if (String(i.status) === "cancelled") status = "rejected";
    else if (scanned) status = "approved";
    else if (now.getTime() > passValidUntil.getTime()) status = "expired";
    else status = "pending";

    return {
      _id: i._id,
      id: String(i._id),
      kind: "candidate",
      visitorName: `${(i.candidate as any)?.firstName ?? ""} ${(i.candidate as any)?.lastName ?? ""}`.trim(),
      visitorEmail: (i.candidate as any)?.email ?? "",
      visitorCompany: (i.job as any)?.title ?? "Position",
      purpose: "Interview",
      hostName: "FlowZen HR",
      identityCode: String(i.passCode || ""),
      passCode: String(i.passCode || ""),
      status,
      inPremises,
      position: (i.job as any)?.title ?? "Position",
      roundType: i.roundType,
      scheduledAt: i.scheduledAt,
      location: i.location,
      interviewer: (i.interviewer as any)?.name ?? "",
      passValidFrom: i.passValidFrom || passValidFrom,
      passValidUntil: i.passValidUntil || passValidUntil,
      candidateId: candId,
      interviewId: String(i._id),
    };
  });

  return NextResponse.json({ passes: [...candidatePasses, ...passes] });
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
