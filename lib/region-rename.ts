import { CompanyPolicy } from "@/models/CompanyPolicy";
import { Holiday } from "@/models/Holiday";
import { ProcurementRequest } from "@/models/ProcurementRequest";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { ATSJob } from "@/models/ATSJob";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { VisitorPass } from "@/models/VisitorPass";
import { User } from "@/models/User";

export interface RegionLabelChange {
  from: string;
  to: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anchoredRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(String(value ?? "").trim())}$`, "i");
}

const norm = (value: unknown): string => String(value ?? "").trim().toLowerCase();

const RENAME_REASON = "Region/office renamed; members assigned here were moved to the new name.";
const REMOVE_REASON = "Region/office removed from the company; member fell back to the main office.";

/**
 * Propagate a region/office rename (or removal) to every place a region's name
 * is stored. The source of truth is `Company.addresses[].label`; the other
 * stores all hold a denormalized string copy that goes stale the moment the
 * office is renamed, which silently unhomes the members displayed under it.
 *
 * Renames are matched case-insensitively so a label stored with the caller's
 * casing is still caught; the stored value is rewritten with the canonical new
 * casing.
 *
 * `company` is the already-mutated (unsaved) company document so its own
 * embedded region-name copies (`identityCodeRegions`, `wfhDates`,
 * `weekendDates`) can be rewritten in place before the caller saves it. Call
 * this AFTER mutating `company.addresses` but BEFORE `company.save()`, so a
 * failure aborts the save and company + members stay on the old name together.
 */
export async function applyRegionLabelChanges(options: {
  company?: unknown;
  companyId: string;
  renames?: RegionLabelChange[];
  removals?: string[];
}): Promise<{ usersUpdated: number }> {
  const companyId = String(options.companyId ?? "");
  const renames = (options.renames ?? []).filter(
    (r) => norm(r.from) && norm(r.from) !== norm(r.to),
  );
  const removals = (options.removals ?? []).filter((label) => norm(label));

  if (!companyId || (renames.length === 0 && removals.length === 0)) {
    return { usersUpdated: 0 };
  }

  const at = new Date();
  let usersUpdated = 0;

  for (const { from, to } of renames) {
    const filter = anchoredRegex(from);

    const userResult = await User.updateMany(
      { company: companyId, regionLabel: filter },
      {
        $set: { regionLabel: to },
        $push: {
          membershipHistory: {
            company: companyId,
            action: "region-corrected",
            at,
            fromRegionLabel: from,
            toRegionLabel: to,
            reason: RENAME_REASON,
          },
        },
      },
    );
    usersUpdated += userResult.modifiedCount ?? 0;

    await Holiday.updateMany({ company: companyId, region: filter }, { $set: { region: to } });
    await ProcurementRequest.updateMany(
      { company: companyId, regionLabel: filter },
      { $set: { regionLabel: to } },
    );
    await ExpenseRequest.updateMany(
      { company: companyId, regionLabel: filter },
      { $set: { regionLabel: to } },
    );
    await ATSJob.updateMany(
      { company: companyId, regionLabel: filter },
      { $set: { regionLabel: to } },
    );
    await ATSOffer.updateMany(
      { company: companyId, regionLabel: filter },
      { $set: { regionLabel: to } },
    );
    await ATSInterview.updateMany({ company: companyId, region: filter }, { $set: { region: to } });
    await VisitorPass.updateMany({ company: companyId, region: filter }, { $set: { region: to } });
    await ATSCandidate.updateMany(
      { company: companyId, joiningRegionLabel: filter },
      { $set: { joiningRegionLabel: to } },
    );

    // `CompanyPolicy` has a unique index on (company, region). When a policy for
    // the target name already exists, renaming the source one would blow up the
    // unique index — the target's own policy wins and the stale source policy is
    // dropped instead of being copied over it.
    const srcPolicies = await CompanyPolicy.find({ company: companyId, region: filter }).select("_id region");
    for (const policy of srcPolicies) {
      if (String(policy.region ?? "") === to) continue;
      const targetExists = await CompanyPolicy.exists({ company: companyId, region: to });
      if (targetExists) {
        await CompanyPolicy.deleteOne({ _id: policy._id });
      } else {
        await CompanyPolicy.updateOne({ _id: policy._id }, { $set: { region: to } });
      }
    }

    const company = options.company as {
      identityCodeRegions?: { region: string }[];
      wfhDates?: { region: string }[];
      weekendDates?: { region: string }[];
      markModified?: (path: string) => void;
    } | null;

    if (company?.identityCodeRegions && Array.isArray(company.identityCodeRegions)) {
      let changed = false;
      for (const entry of company.identityCodeRegions) {
        if (entry && norm(entry.region) === norm(from)) {
          entry.region = to;
          changed = true;
        }
      }
      if (changed) company.markModified?.("identityCodeRegions");
    }

    for (const path of ["wfhDates", "weekendDates"] as const) {
      const list = company?.[path];
      if (list && Array.isArray(list)) {
        let changed = false;
        for (const entry of list) {
          if (entry && norm(entry.region) === norm(from)) {
            entry.region = to;
            changed = true;
          }
        }
        if (changed) company.markModified?.(path);
      }
    }

    if (userResult.modifiedCount > 0) {
      console.info(`region-rename: "${from}" -> "${to}" re-homed ${userResult.modifiedCount} member(s).`);
    }
  }

  for (const label of removals) {
    const filter = anchoredRegex(label);

    const userResult = await User.updateMany(
      { company: companyId, regionLabel: filter },
      {
        $set: { regionLabel: "" },
        $push: {
          membershipHistory: {
            company: companyId,
            action: "region-corrected",
            at,
            fromRegionLabel: label,
            toRegionLabel: "",
            reason: REMOVE_REASON,
          },
        },
      },
    );
    usersUpdated += userResult.modifiedCount ?? 0;

    // Operational/display snapshots follow their region away. Holidays, salary
    // policies and identity-code ranges are admin config: guessing what a
    // removed region's config should become is worse than leaving it untouched.
    await ProcurementRequest.updateMany({ company: companyId, regionLabel: filter }, { $set: { regionLabel: "" } });
    await ExpenseRequest.updateMany({ company: companyId, regionLabel: filter }, { $set: { regionLabel: "" } });
    await ATSJob.updateMany({ company: companyId, regionLabel: filter }, { $set: { regionLabel: "" } });
    await ATSOffer.updateMany({ company: companyId, regionLabel: filter }, { $set: { regionLabel: "" } });
    await ATSInterview.updateMany({ company: companyId, region: filter }, { $set: { region: "" } });
    await VisitorPass.updateMany({ company: companyId, region: filter }, { $set: { region: "" } });
    await ATSCandidate.updateMany(
      { company: companyId, joiningRegionLabel: filter },
      { $set: { joiningRegionLabel: "" } },
    );

    if (userResult.modifiedCount > 0) {
      console.info(`region-remove: "${label}" unassigned ${userResult.modifiedCount} member(s).`);
    }
  }

  return { usersUpdated };
}