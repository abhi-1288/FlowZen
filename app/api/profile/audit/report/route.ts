import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { canViewAuditCenter } from "@/lib/audit";
import { recordAudit } from "@/lib/audit";

const PROFILE_FIELDS = "name email phone emergencyContact employmentType companyIdentityCode employmentEndDate regionLabel role isSeniorSecurity";

function profileBlock(u: any) {
  return {
    id: String(u?._id ?? u?.id ?? ""),
    name: u?.name ?? "",
    email: u?.email ?? "",
    phone: u?.phone ?? "",
    emergencyContact: u?.emergencyContact ?? "",
    employmentType: u?.employmentType ?? "",
    uniqueIdentity: u?.companyIdentityCode ?? "",
    exitDate: u?.employmentEndDate ?? null,
    region: u?.regionLabel ?? "",
    role: u?.role ?? "",
    isSeniorSecurity: Boolean(u?.isSeniorSecurity),
  };
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select(
    "role company companyStatus isSeniorSecurity " + PROFILE_FIELDS,
  );
  if (!actor || !actor.company || String(actor.companyStatus) !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }
  if (!canViewAuditCenter(String(actor.role ?? ""), Boolean((actor as any).isSeniorSecurity))) {
    return jsonError("You do not have access to the audit center.", 403);
  }

  const url = new URL(request.url);
  const targetId = String(url.searchParams.get("userId") ?? "").trim();
  const fromRaw = String(url.searchParams.get("from") ?? "").trim();
  const toRaw = String(url.searchParams.get("to") ?? "").trim();

  if (!targetId) return jsonError("userId is required.", 400);

  const target = await User.findById(targetId).select(PROFILE_FIELDS + " company companyStatus");
  if (!target || String(target.company) !== String(actor.company)) {
    return jsonError("Audited user not found in your company.", 404);
  }

  const company = await Company.findById(actor.company);

  const createdAtScope: Record<string, any> = {};
  const fromTime = new Date(fromRaw).getTime();
  const toTime = new Date(toRaw).getTime();
  if (fromRaw && !Number.isNaN(fromTime)) createdAtScope.$gte = new Date(fromRaw);
  if (toRaw && !Number.isNaN(toTime)) {
    const end = new Date(toRaw);
    end.setHours(23, 59, 59, 999);
    createdAtScope.$lte = end;
  }

  const query: Record<string, any> = {
    company: actor.company,
    $or: [{ actor: target._id }, { target: target._id }],
  };
  if (Object.keys(createdAtScope).length) query.createdAt = createdAtScope;

  const total = await AuditLog.countDocuments(query);
  const items = await AuditLog.find(query).sort({ createdAt: 1 }).limit(5000);

  // Record the export action (observational).
  try {
    await recordAudit({
      action: "data.export",
      actionLabel: "Audit report downloaded",
      company: actor.company,
      actor: { id: actor._id, name: actor.name, email: actor.email, role: actor.role },
      target: { id: target._id, name: target.name, email: target.email, role: target.role },
      entityType: "audit-report",
      entityId: String(target._id),
      metadata: { from: fromRaw || null, to: toRaw || null, count: total },
      request,
    });
  } catch {
    // ignore
  }

  const mainAddress =
    Array.isArray(company?.addresses) && company.addresses.length
      ? company.addresses.find((a: any) => a?.isMain) || company.addresses[0]
      : null;

  const companyBlock = {
    name: company?.name ?? "",
    address: mainAddress
      ? [mainAddress.label, mainAddress.line1, mainAddress.city, mainAddress.state, mainAddress.zip, mainAddress.country]
          .filter(Boolean)
          .join(", ")
      : (company?.address ?? ""),
    region: mainAddress?.label ?? (company?.address ?? ""),
    contact:
      company?.supportEmail ??
      (Array.isArray(mainAddress?.contacts) && mainAddress.contacts.length
        ? mainAddress.contacts.map((c: any) => c?.email || c?.phone).filter(Boolean).join(", ")
        : ""),
  };

  return NextResponse.json({
    company: companyBlock,
    audited: profileBlock(target),
    auditor: profileBlock(actor),
    auditDate: new Date().toISOString(),
    from: fromRaw || null,
    to: toRaw || null,
    total,
    items: items.map((d: any) => serializeDoc(d)),
  });
}