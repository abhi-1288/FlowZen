import { useState } from "react";
import { Building2 } from "lucide-react";
import { ActionButton, AnyRecord, formatRoleWithCustom } from "../../shared";
import { currencySymbol } from "../helpers";
import { apiFetch } from "@/lib/client-utils";
import { effectiveRegionLabelOf, withMainOfficeSuffix } from "@/lib/company-regions";

/**
 * One member row, with the full set of actions.
 *
 * Shared by the per-role modal and by the region-grouped list on the page
 * itself. Both need the same buttons — salary, PF/ESIC, documents, region,
 * employment type, role, fire — so the markup lives here rather than being
 * written twice and drifting.
 */
export function MemberCard({
  member,
  company,
  selfId,
  canEditOthersRole,
  firingFor,
  onRequestFire,
  onOpenSalaryModal,
  onOpenPfEsicModal,
  onOpenDocModal,
  onOpenRoleModal,
  onOpenCustomRoleModal,
  onOpenRegionModal,
  onOpenEmploymentModal,
  showToast,
  onRefresh,
}: {
  member: AnyRecord;
  company: AnyRecord | null;
  selfId: string;
  canEditOthersRole: boolean;
  firingFor: string | null;
  onRequestFire: (member: AnyRecord) => void;
  onOpenSalaryModal: (member: AnyRecord) => void;
  onOpenPfEsicModal: (member: AnyRecord) => void;
  onOpenDocModal: (member: AnyRecord) => void;
  onOpenRoleModal: (member: AnyRecord) => void;
  onOpenCustomRoleModal: (member: AnyRecord) => void;
  onOpenRegionModal?: (member: AnyRecord) => void;
  onOpenEmploymentModal?: (member: AnyRecord) => void;
  showToast: (text: string, type?: "success" | "error") => void;
  onRefresh?: (silent?: boolean) => Promise<void>;
}) {
  const [revokingIdCardFor, setRevokingIdCardFor] = useState<string | null>(null);

  const memberId = String(member.id);
  const teams = Array.isArray(member.teams) ? member.teams.map(String) : [];
  const isSelf = Boolean(selfId) && memberId === selfId;
  const joinedBy =
    member.joinedBy && typeof member.joinedBy === "object" ? (member.joinedBy as AnyRecord) : null;

  async function revokeIdCard() {
    setRevokingIdCardFor(memberId);
    try {
      await apiFetch("/api/hr/revoke-id-card", {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      showToast("ID card revoked.");
      if (onRefresh) await onRefresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not revoke ID card.", "error");
    } finally {
      setRevokingIdCardFor(null);
    }
  }

  return (
    <li className="rounded-xl neu-card p-4 dark:border-zinc-800 dark:bg-[#000000]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-zinc-100">{String(member.name ?? "Member")}</p>
          <p className="truncate text-sm text-slate-500 dark:text-zinc-400">{String(member.email ?? "")}</p>
          {joinedBy?.name ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Joined by <span className="font-medium text-slate-700 dark:text-zinc-200">{String(joinedBy.name)}</span>
            </p>
          ) : null}
        </div>

        <div className="grid items-center gap-2">
          <span className="rounded-lg neu-inset px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-200">
            role: {formatRoleWithCustom(String(member.role ?? "employee"), member.customRole, Boolean(member.isSeniorSecurity))}
          </span>
          <span className="rounded-lg neu-inset px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-200">
            salary: {(() => {
              const cur = String(member.salaryCurrency ?? "INR");
              return Number(member.baseSalary ?? 0) > 0
                ? `${currencySymbol(cur)} ${Number(member.baseSalary).toLocaleString("en-IN")}`
                : "not set";
            })()}
          </span>
          <span
            className="rounded-lg neu-inset px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-200"
            title={teams.length ? teams.join(", ") : "No team joined"}
          >
            team: {teams.length ? teams.join(", ") : "-"}
          </span>
          <span className="rounded-lg neu-inset px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-200">
            region: {withMainOfficeSuffix(company, effectiveRegionLabelOf(company, member)) || "Unassigned"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <ActionButton variant="primary" className="px-3" type="button" onClick={() => onOpenSalaryModal(member)}>Base Salary</ActionButton>
          <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenPfEsicModal(member)}>PF &amp; ESIC</ActionButton>
          <ActionButton variant="secondary" className="px-3" type="button" onClick={() => void onOpenDocModal(member)}>Documents</ActionButton>
          {onOpenRegionModal ? (
            <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenRegionModal(member)}>
              <Building2 className="mr-1 inline-block h-3.5 w-3.5" />Region
            </ActionButton>
          ) : null}
          {onOpenEmploymentModal ? (
            <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenEmploymentModal(member)}>
              Employment Type
            </ActionButton>
          ) : null}
          <ActionButton
            variant="danger"
            className="px-3"
            type="button"
            disabled={revokingIdCardFor === memberId}
            onClick={() => void revokeIdCard()}
          >
            {revokingIdCardFor === memberId ? "Revoking..." : "Revoke ID Card"}
          </ActionButton>
          {canEditOthersRole && !isSelf ? (
            <>
              <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenCustomRoleModal(member)}>Custom Role</ActionButton>
              <ActionButton variant="secondary" className="px-3" type="button" onClick={() => onOpenRoleModal(member)}>Change Role</ActionButton>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <ActionButton variant="danger" className="px-3" disabled={!!isSelf || firingFor === memberId} type="button" onClick={() => onRequestFire(member)}>
            {firingFor === memberId ? "Removing..." : "Fire"}
          </ActionButton>
        </div>
      </div>
    </li>
  );
}
