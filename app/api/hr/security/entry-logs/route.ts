import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";
import { EntryLog } from "@/models/EntryLog";
import { Attendance } from "@/models/Attendance";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
  const type = url.searchParams.get("type") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  const filter: Record<string, unknown> = { company: actor.company };
  if (type === "entry" || type === "exit") filter.type = type;

  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    filter.timestamp = { $gte: dayStart, $lte: dayEnd };
  } else if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);
    filter.timestamp = dateFilter;
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    EntryLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email avatarUrl companyIdentityCode role")
      .populate("recordedBy", "name")
      .lean() as Promise<Record<string, unknown>[]>,
    EntryLog.countDocuments(filter),
  ]);

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: String(log._id),
      user: log.user,
      visitorPass: log.visitorPass,
      type: log.type,
      method: log.method,
      recordedBy: log.recordedBy,
      timestamp: log.timestamp,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
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

  const actor = await User.findById(userId).select("company role name");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource", "security"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const body = await request.json();
  const rawCode = String(body.code ?? "").trim();
  const type = String(body.type ?? "").trim();

  if (!rawCode) return jsonError("Identity code is required.", 400);
  if (type !== "entry" && type !== "exit") return jsonError("Type must be 'entry' or 'exit'.", 400);

  const codeRegex = new RegExp(`^${rawCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  // Try to find employee
  const employee = await User.findOne({
    company: actor.company,
    companyIdentityCode: { $regex: codeRegex },
  }).select("_id name");

  if (employee) {
    await EntryLog.create({
      user: employee._id,
      company: actor.company,
      type,
      method: "qr-scan",
      recordedBy: userId,
    });

    // Also update attendance — but self-service always takes priority
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await Attendance.findOne({ user: employee._id, date: today });

    if (type === "entry" && !existing) {
      await Attendance.create({
        user: employee._id,
        date: today,
        checkIn: new Date(),
        status: "present",
      });
    } else if (type === "exit" && existing && existing.checkIn && !existing.checkOut) {
      existing.checkOut = new Date();
      await existing.save();
    }

    return NextResponse.json({ success: true, person: String(employee.name) });
  }

  // Try to find visitor pass
  const pass = await VisitorPass.findOne({
    company: actor.company,
    identityCode: { $regex: codeRegex },
  }).select("_id visitorName status");

  if (pass) {
    await EntryLog.create({
      visitorPass: pass._id,
      company: actor.company,
      type,
      method: "qr-scan",
      recordedBy: userId,
    });

    if (type === "entry" && pass.status === "approved") {
      await VisitorPass.updateOne({ _id: pass._id }, { $set: { status: "active", entryTime: new Date() } });
    } else if (type === "exit" && pass.status === "active") {
      await VisitorPass.updateOne({ _id: pass._id }, { $set: { status: "completed", exitTime: new Date() } });
    }

    return NextResponse.json({ success: true, person: String(pass.visitorName) });
  }

  return jsonError("No match found for this code.", 404);
}
