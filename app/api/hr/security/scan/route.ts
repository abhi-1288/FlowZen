import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";
import { EntryLog } from "@/models/EntryLog";
import { ATSInterview } from "@/models/ATSInterview";
import { findCandidateByToken, findInterviewPassByCode } from "@/lib/candidate-portal";

async function candidateResult(passInterview: any) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const candId = String((passInterview.candidate as any)?._id);

  const lastEntryToday = await EntryLog.findOne({
    candidate: candId,
    company: passInterview.company,
    type: "entry",
    timestamp: { $gte: todayStart, $lt: todayEnd },
  }).sort({ timestamp: -1 }).lean() as Record<string, unknown> | null;

  let hasActiveEntry = false;
  if (lastEntryToday) {
    const exitAfter = await EntryLog.findOne({
      candidate: candId,
      company: passInterview.company,
      type: "exit",
      timestamp: { $gt: lastEntryToday.timestamp, $lt: todayEnd },
    }).lean() as Record<string, unknown> | null;
    hasActiveEntry = !exitAfter;
  }

  return NextResponse.json({
    type: "candidate",
    hasActiveEntry,
    data: {
      candidateId: candId,
      interviewId: String(passInterview._id),
      name: `${(passInterview.candidate as any)?.firstName ?? ""} ${(passInterview.candidate as any)?.lastName ?? ""}`.trim(),
      email: (passInterview.candidate as any)?.email ?? "",
      role: (passInterview.job as any)?.title ?? "Position",
      roundType: passInterview.roundType,
      scheduledAt: passInterview.scheduledAt,
      location: passInterview.location,
      interviewer: (passInterview.interviewer as any)?.name ?? "",
      passCode: passInterview.passCode,
    },
  });
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

  const actor = await User.findById(userId).select("company role");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource", "security"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const body = await request.json();
  const rawCode = String(body.code ?? "").trim();
  if (!rawCode) return jsonError("Identity code is required.", 400);

  // Case-insensitive search
  const codeRegex = new RegExp(`^${rawCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  // Try to find an employee with this identity code
  const employee = await User.findOne({
    company: actor.company,
    companyIdentityCode: { $regex: codeRegex },
  }).select("name email role companyStatus avatarUrl phone emergencyContact bloodGroup regionLabel").lean() as Record<string, unknown> | null;

  if (employee) {
    // Check if there's an active entry today (entry without exit after it)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const lastEntryToday = await EntryLog.findOne({
      user: employee._id,
      company: actor.company,
      type: "entry",
      timestamp: { $gte: todayStart, $lt: todayEnd },
    }).sort({ timestamp: -1 }).lean() as Record<string, unknown> | null;

    let hasActiveEntry = false;
    if (lastEntryToday) {
      const exitAfter = await EntryLog.findOne({
        user: employee._id,
        company: actor.company,
        type: "exit",
        timestamp: { $gt: lastEntryToday.timestamp, $lt: todayEnd },
      }).lean() as Record<string, unknown> | null;
      hasActiveEntry = !exitAfter;
    }

    return NextResponse.json({
      type: "employee",
      hasActiveEntry,
      data: {
        id: String(employee._id),
        name: employee.name,
        email: employee.email,
        role: employee.role,
        companyStatus: employee.companyStatus,
        avatarUrl: employee.avatarUrl,
        phone: employee.phone,
        emergencyContact: employee.emergencyContact,
        bloodGroup: employee.bloodGroup,
        regionLabel: employee.regionLabel,
      },
    });
  }

  // Try to find a visitor pass with this identity code
  const pass = await VisitorPass.findOne({
    company: actor.company,
    identityCode: { $regex: codeRegex },
  }).lean() as Record<string, unknown> | null;

  if (pass) {
    const now = new Date();
    let status = String(pass.status ?? "");
    if (status === "approved" && pass.validUntil && new Date(String(pass.validUntil)) < now) {
      await VisitorPass.updateOne({ _id: pass._id }, { $set: { status: "expired" } });
      status = "expired";
    }

    // Check if there's an active entry today (entry without exit after it)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const lastEntryToday = await EntryLog.findOne({
      visitorPass: pass._id,
      company: actor.company,
      type: "entry",
      timestamp: { $gte: todayStart, $lt: todayEnd },
    }).sort({ timestamp: -1 }).lean() as Record<string, unknown> | null;

    let hasActiveEntry = false;
    if (lastEntryToday) {
      const exitAfter = await EntryLog.findOne({
        visitorPass: pass._id,
        company: actor.company,
        type: "exit",
        timestamp: { $gt: lastEntryToday.timestamp, $lt: todayEnd },
      }).lean() as Record<string, unknown> | null;
      hasActiveEntry = !exitAfter;
    }

    const isProcessed = status === "completed" || status === "expired";

    return NextResponse.json({
      type: "visitor",
      hasActiveEntry,
      isProcessed,
      data: {
        id: String(pass._id),
        visitorName: pass.visitorName,
        visitorEmail: pass.visitorEmail,
        visitorPhone: pass.visitorPhone,
        visitorCompany: pass.visitorCompany,
        purpose: pass.purpose,
        hostName: pass.hostName,
        status,
        validFrom: pass.validFrom,
        validUntil: pass.validUntil,
        identityCode: pass.identityCode,
      },
    });
  }

  // Supports legacy candidate QR codes that embed a full /verify-pass URL
  // (or a bare TOKEN:INTERVIEW_ID string) instead of a plain pass code.
  const tokenMatch =
    rawCode.match(/[?&]token=([^&]+)/) ||
    (rawCode.includes(":") && rawCode.match(/^[^\s]+:[A-Za-z0-9]+$/) ? [null, rawCode] : null);
  if (tokenMatch && tokenMatch[1]) {
    const tokenValue = decodeURIComponent(tokenMatch[1]);
    const separatorIndex = tokenValue.lastIndexOf(":");
    if (separatorIndex > 0 && separatorIndex < tokenValue.length - 1) {
      const magicToken = tokenValue.slice(0, separatorIndex);
      const interviewId = tokenValue.slice(separatorIndex + 1);
      if (magicToken && isObjectId(interviewId)) {
        const candidate = await findCandidateByToken(magicToken);
        if (candidate) {
          const legacyInterview: any = await ATSInterview.findOne({
            _id: interviewId,
            candidate: candidate._id,
            company: actor.company,
            status: "scheduled",
          })
            .populate("candidate", "firstName lastName email")
            .populate("job", "title")
            .populate("interviewer", "name");
          if (legacyInterview) return await candidateResult(legacyInterview);
        }
      }
    }
  }

  // Try to find a candidate guest pass by its scannable pass code
  const passInterview: any = await findInterviewPassByCode(actor.company, rawCode);
  if (passInterview) {
    return await candidateResult(passInterview);
  }

  return NextResponse.json({ type: "not-found", data: null });
}