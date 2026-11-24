import { Company } from "@/models/Company";
import { User } from "@/models/User";
import {
  effectiveRegionLabelOf,
  regionEntryOf,
  regionStaffingOf,
  type OfficeAddressLike,
} from "@/lib/company-regions";

export type DepartmentApproverOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  region: string;
  label: string;
};

export type DepartmentRouting = {
  mode: "direct" | "approve";
  region: string;
  options: DepartmentApproverOption[];
  reason: string;
};

/** HR head and admin head configured for a region. Shared by create + delete. */
export async function departmentRegionHeads(
  companyId: unknown,
  region: string,
): Promise<{ hrHeadId: string; adminHeadId: string }> {
  const company = await Company.findById(companyId).select("addresses address").lean();
  const staffing = regionStaffingOf(regionEntryOf(company as any, region));
  return { hrHeadId: staffing.hrHead, adminHeadId: staffing.adminHead };
}

/**
 * Decides who a department request goes to, based on the requester's role:
 *  - admin head of the region      -> no approval needed, create directly
 *  - HR head                       -> pick an admin head (final step)
 *  - everyone else                 -> pick an HR head, who forwards to the
 *                                     region's admin head (fallback: admin head)
 *
 * Own region is always listed first. Server-side so the picker and the POST
 * validation cannot disagree.
 */
export async function resolveDepartmentRouting(
  companyId: unknown,
  userId: string,
): Promise<DepartmentRouting> {
  const user = await User.findById(userId).select("role companyStatus regionLabel name");
  if (!user) throw new Error("User not found.");
  if (String(user.companyStatus) !== "approved") {
    throw new Error("Your company membership is not approved.");
  }

  const company = await Company.findById(companyId).select("owner addresses address").lean();
  if (!company) throw new Error("Company not found.");

  const region = effectiveRegionLabelOf(company as any, user as any);
  const ownStaffing = regionStaffingOf(regionEntryOf(company as any, region));
  const self = String(userId);

  const isHr = String(user.role) === "human-resource";
  const isAdmin = String(user.role) === "admin";
  const isHrHead = isHr && ownStaffing.hrHead === self;
  const isAdminHead = isAdmin && ownStaffing.adminHead === self;

  if (isAdminHead) {
    return {
      mode: "direct",
      region,
      options: [],
      reason: "You are the admin head of this region. Your department will be created directly without an approval.",
    };
  }

  // Every request starts with an HR head, who forwards it to the region's
  // admin head. The HR head themselves already performed that first step, so
  // they pick the admin head directly.
  const wantsAdmin = isHrHead;
  const ownRegion = region.trim().toLowerCase();
  const addresses = (Array.isArray((company as any).addresses)
    ? (company as any).addresses
    : []) as OfficeAddressLike[];
  const ordered = [...addresses].sort((a, b) => {
    const aOwn = String(a?.label ?? "").trim().toLowerCase() === ownRegion ? 0 : 1;
    const bOwn = String(b?.label ?? "").trim().toLowerCase() === ownRegion ? 0 : 1;
    return aOwn - bOwn;
  });

  const candidates: { id: string; role: string; region: string }[] = [];
  const push = (id: string, role: string, label: string) => {
    if (!id || id === self) return;
    if (candidates.some((c) => c.id === id)) return;
    candidates.push({ id, role, region: label || "Main Office" });
  };

  for (const entry of ordered) {
    const label = String(entry?.label ?? "").trim() || "Main Office";
    const staffing = regionStaffingOf(entry);
    if (wantsAdmin) push(staffing.adminHead, "admin", label);
    else push(staffing.hrHead, "human-resource", label);
  }
  // If no HR head is configured anywhere, an admin head can handle both steps.
  if (!wantsAdmin && candidates.length === 0) {
    for (const entry of ordered) {
      const label = String(entry?.label ?? "").trim() || "Main Office";
      push(regionStaffingOf(entry).adminHead, "admin", label);
    }
  }

  let picked = await User.find({
    _id: { $in: candidates.map((c) => c.id) },
    company: companyId,
    companyStatus: "approved",
  }).select("name email role").lean();

  let usedFallback = picked.length === 0;
  let reason: string;

  if (usedFallback) {
    picked = await User.find({
      company: companyId,
      role: { $in: wantsAdmin ? ["admin"] : ["human-resource", "admin"] },
      companyStatus: "approved",
      _id: { $ne: self },
    })
      .select("name email role")
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();
    reason = "No region head is assigned yet. Showing approved members instead — please pick the approver explicitly.";
  } else {
    reason = wantsAdmin
      ? "As the HR head of this region, choose an admin head for the final approval."
      : "Choose the HR head who will review this request and forward it to the region's admin head.";
  }

  const byId = new Map(picked.map((u) => [String(u._id), u as any]));
  const options: DepartmentApproverOption[] = [];
  for (const candidate of candidates) {
    const u = byId.get(candidate.id);
    if (!u) continue;
    options.push({
      id: candidate.id,
      name: String(u.name ?? ""),
      email: String(u.email ?? ""),
      role: String(u.role ?? candidate.role),
      region: candidate.region,
      label: `${String(u.name ?? "Member")} · ${candidate.role === "admin" ? "Admin Head" : "HR Head"} · ${candidate.region}`,
    });
  }

  if (usedFallback) {
    const seen = new Set(options.map((o) => o.id));
    for (const u of picked) {
      const id = String(u._id);
      if (seen.has(id)) continue;
      options.push({
        id,
        name: String(u.name ?? ""),
        email: String(u.email ?? ""),
        role: String(u.role ?? ""),
        region: region || "Main Office",
        label: `${String(u.name ?? "Member")} · ${String(u.role ?? "") === "admin" ? "Admin" : "HR"} · ${region || "Main Office"}`,
      });
    }
  }

  return { mode: "approve", region, options, reason: options.length ? reason : "No approver is available yet. Ask an admin to assign a region head first." };
}
