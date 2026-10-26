import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { AttendanceExportRequest } from "@/models/AttendanceExportRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { recordAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(); if (!userId) return jsonError("Unauthorized", 401);
  await connectDb(); const { id } = await params; const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? ""); if (!["approve", "reject"].includes(action)) return jsonError("Invalid decision.");
  const row: any = await AttendanceExportRequest.findOne({ _id: id, approver: userId, status: "pending" }).populate("requester", "name role");
  if (!row) return jsonError("Approval request not found or already decided.", 404);
  row.status = action === "approve" ? "approved" : "rejected"; row.decidedAt = new Date(); row.decisionReason = String(body.reason ?? "").trim().slice(0, 500); await row.save();
  await Notification.create({ user: row.requester._id, company: row.company, type: action === "approve" ? "approval" : "system", title: action === "approve" ? "Attendance export approved" : "Attendance export rejected", message: action === "approve" ? `Your ${row.region} attendance export is ready to download.` : `Your ${row.region} attendance export request was rejected.`, link: "/profile/attendance" });
  await recordAudit({ action: `attendance.export.${action}d`, actionLabel: `Cross-region attendance export ${action}d`, company: row.company, actor: userId, target: String(row.requester._id), entityType: "AttendanceExportRequest", entityId: id, metadata: { region: row.region, from: row.from, to: row.to, reason: row.decisionReason } });
  return NextResponse.json({ ok: true, status: row.status });
}
