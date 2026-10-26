import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { AttendanceExportRequest } from "@/models/AttendanceExportRequest";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { effectiveRegionLabelOf, regionEntryOf, regionLabelsOf } from "@/lib/company-regions";
import { recordAudit } from "@/lib/audit";

function day(value: unknown) {
  const raw = String(value ?? "");
  const parts = raw.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const result = new Date(parts[0], parts[1] - 1, parts[2]);
  return result.getFullYear() === parts[0] && result.getMonth() === parts[1] - 1 && result.getDate() === parts[2] ? result : null;
}

function serialize(row: any) {
  return { id: String(row._id), region: row.region, from: row.from, to: row.to, status: row.status, approver: row.approver && { id: String(row.approver._id ?? row.approver), name: row.approver.name, role: row.approver.role }, decidedAt: row.decidedAt, decisionReason: row.decisionReason ?? "" };
}

export async function GET(request: Request) {
  const userId = await requireUserId(); if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor: any = await User.findById(userId).select("company role regionLabel name");
  if (!actor?.company) return jsonError("You must belong to an approved company.", 403);
  if (actor.role !== "finance") {
    if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("You are not an attendance export approver.", 403);
    const incoming = await AttendanceExportRequest.find({ company: actor.company, approver: userId }).populate("requester", "name role").sort({ createdAt: -1 }).limit(50);
    return NextResponse.json({ requests: incoming.map((row: any) => ({ id: String(row._id), region: row.region, from: row.from, to: row.to, status: row.status, requester: row.requester && { name: row.requester.name, role: row.requester.role }, decisionReason: row.decisionReason ?? "" })) });
  }
  const company: any = await Company.findById(actor.company).select("addresses address").lean();
  const ownRegion = effectiveRegionLabelOf(company, actor);
  const regionData = regionLabelsOf(company).map((region) => {
    const entry: any = regionEntryOf(company, region);
    const ids = [entry?.hrHead, entry?.adminHead].filter(Boolean).map(String);
    return { region, approvers: ids };
  });
  const approverIds = Array.from(new Set(regionData.flatMap((item) => item.approvers)));
  const approvers = await User.find({ _id: { $in: approverIds }, company: actor.company, companyStatus: "approved" }).select("name role regionLabel").lean();
  const approverMap = new Map(approvers.map((person: any) => [String(person._id), { id: String(person._id), name: person.name, role: person.role }]));
  const regions = regionData.map((item) => ({ region: item.region, approvers: item.approvers.map((id) => approverMap.get(id)).filter(Boolean) }));
  const requests = await AttendanceExportRequest.find({ company: actor.company, requester: userId }).populate("approver", "name role").sort({ createdAt: -1 }).limit(30);
  return NextResponse.json({ ownRegion, regions, requests: requests.map(serialize) });
}

export async function POST(request: Request) {
  const userId = await requireUserId(); if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const body = await request.json().catch(() => ({}));
  const actor: any = await User.findById(userId).select("company role regionLabel name");
  if (!actor?.company || actor.role !== "finance") return jsonError("Only Finance users can request cross-region attendance exports.", 403);
  const company: any = await Company.findById(actor.company).select("addresses address").lean();
  const ownRegion = effectiveRegionLabelOf(company, actor);
  const region = String(body.region ?? "").trim(); const approverId = String(body.approverId ?? "").trim();
  const from = day(body.from); const to = day(body.to);
  if (!region || region.toLowerCase() === ownRegion.toLowerCase()) return jsonError("Your own region does not require an export request.");
  if (!from || !to || from > to) return jsonError("Choose a valid date range.");
  if (Math.floor((to.getTime() - from.getTime()) / 86400000) + 1 > 92) return jsonError("Attendance exports are limited to 92 days.");
  const entry: any = regionEntryOf(company, region); if (!entry) return jsonError("Select a valid company region.");
  const allowedApproverIds = [entry.hrHead, entry.adminHead].filter(Boolean).map(String);
  if (!allowedApproverIds.includes(approverId)) return jsonError("Select the HR head or Admin head assigned to that region.");
  const approver: any = await User.findOne({ _id: approverId, company: actor.company, companyStatus: "approved" }).select("name role");
  if (!approver) return jsonError("The selected approver is no longer available.");
  const duplicate = await AttendanceExportRequest.findOne({ company: actor.company, requester: userId, region, from, to, status: "pending" });
  if (duplicate) return NextResponse.json({ request: serialize(duplicate), alreadyPending: true });
  const row: any = await AttendanceExportRequest.create({ company: actor.company, requester: userId, region, from, to, approver: approverId });
  await Notification.create({ user: approverId, company: actor.company, type: "approval", title: "Attendance export approval requested", message: `${actor.name} requested a ${region} attendance export for ${body.from} to ${body.to}.`, link: "/profile/attendance" });
  await recordAudit({ action: "attendance.export.requested", actionLabel: "Cross-region attendance export requested", company: actor.company, actor: userId, target: approverId, entityType: "AttendanceExportRequest", entityId: String(row._id), metadata: { region, from: body.from, to: body.to } });
  return NextResponse.json({ request: serialize(row) }, { status: 201 });
}
