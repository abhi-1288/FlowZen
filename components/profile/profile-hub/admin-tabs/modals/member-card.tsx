import { useState } from "react";
import { motion } from "framer-motion";
import { Banknote, Briefcase, Building2, CreditCard, FolderOpen, MapPin, Receipt, Tag, UserCog, UserMinus, Users } from "lucide-react";
import { ActionButton, AnyRecord, AvatarBadge, formatRoleWithCustom } from "../../shared";
import { currencySymbol } from "../helpers";
import { apiFetch } from "@/lib/client-utils";
import { effectiveRegionLabelOf, withMainOfficeSuffix } from "@/lib/company-regions";
import { memberRoleChipMeta } from "../types";

/**
 * One member row, with the full set of actions.
 *
 * Rendered inside the per-role member list modal, which owns the role
 * filtering and the Excel export. The row keeps every per-member action —
 * salary, PF/ESIC, documents, region, employment type, role, fire — in one
 * place so the action set never drifts between consumers.
 *
 * The root is a `motion.li` so the parent list can stagger the whole set.
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

  const roleChip = memberRoleChipMeta(String(member.role ?? "employee"), Boolean(member.isSeniorSecurity));
  const RoleIcon = roleChip.icon;

  const baseSalary = Number(member.baseSalary ?? 0);
  const salaryCurrency = String(member.salaryCurrency ?? "INR");
  const salaryChip = baseSalary > 0 ? `${currencySymbol(salaryCurrency)} ${baseSalary.toLocaleString("en-IN")}` : "Not set";

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

  const chipClass =
    "inline-flex items-center gap-1.5 rounded-full bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] px-3 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300";
  const chipIcon = "shrink-0 text-slate-400 dark:text-zinc-500";

  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
      }}
      className="neu-card rounded-2xl p-4 dark:border-zinc-800 dark:bg-[#000000]"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        {/* ── Identity ── */}
        <div className="flex min-w-0 items-start gap-3">
          <AvatarBadge
            avatarUrl={String(member.avatarUrl ?? "")}
            name={String(member.name ?? "Member")}
            size="lg"
            showRing={isSelf}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900 dark:text-zinc-100">{String(member.name ?? "Member")}</p>
              {isSelf ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  You
                </span>
              ) : null}
            </div>
            <p className="truncate text-sm text-slate-500 dark:text-zinc-400">{String(member.email ?? "")}</p>
            {joinedBy?.name ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Joined by <span className="font-medium text-slate-700 dark:text-zinc-200">{String(joinedBy.name)}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Role / meta chips ── */}
        <div className="flex flex-wrap content-start items-center gap-2 xl:max-w-[320px]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${roleChip.chip}`}
            title={formatRoleWithCustom(String(member.role ?? "employee"), member.customRole, Boolean(member.isSeniorSecurity))}
          >
            <RoleIcon size={12} />
            {formatRoleWithCustom(String(member.role ?? "employee"), member.customRole, Boolean(member.isSeniorSecurity))}
          </span>
          <span className={chipClass} title="Base salary">
            <Banknote size={12} className={chipIcon} />
            {salaryChip}
          </span>
          <span className={chipClass} title={teams.length ? teams.join(", ") : "No team joined"}>
            <Users size={12} className={chipIcon} />
            <span className="max-w-[150px] truncate">{teams.length ? teams.join(", ") : "No team"}</span>
          </span>
          <span className={chipClass} title="Region / office">
            <MapPin size={12} className={chipIcon} />
            <span className="max-w-[150px] truncate">
              {withMainOfficeSuffix(company, effectiveRegionLabelOf(company, member)) || "Unassigned"}
            </span>
          </span>
        </div>

        {/* ── Actions ── */}
        <div className="grid grid-cols-2 gap-2 sm:w-[300px] xl:w-[340px]">
          <ActionButton variant="primary" className="w-full justify-start px-3 py-1.5 text-xs" type="button" onClick={() => onOpenSalaryModal(member)}>
            <Banknote size={13} /> Base Salary
          </ActionButton>
          <ActionButton variant="secondary" className="w-full justify-start px-3 py-1.5 text-xs" type="button" onClick={() => onOpenPfEsicModal(member)}>
            <Receipt size={13} /> PF &amp; ESIC
          </ActionButton>
          <ActionButton variant="secondary" className="w-full justify-start px-3 py-1.5 text-xs" type="button" onClick={() => void onOpenDocModal(member)}>
            <FolderOpen size={13} /> Documents
          </ActionButton>
          {onOpenRegionModal ? (
            <ActionButton variant="secondary" className="w-full justify-start px-3 py-1.5 text-xs" type="button" onClick={() => onOpenRegionModal(member)}>
              <Building2 size={13} /> Region
            </ActionButton>
          ) : null}
          {onOpenEmploymentModal ? (
            <ActionButton variant="secondary" className="w-full justify-start px-3 py-1.5 text-xs" type="button" onClick={() => onOpenEmploymentModal(member)}>
              <Briefcase size={13} /> Employment Type
            </ActionButton>
          ) : null}
          <ActionButton
            variant="danger"
            className="w-full justify-start px-3 py-1.5 text-xs"
            type="button"
            disabled={revokingIdCardFor === memberId}
            onClick={() => void revokeIdCard()}
          >
            <CreditCard size={13} /> {revokingIdCardFor === memberId ? "Revoking..." : "Revoke ID"}
          </ActionButton>
          {canEditOthersRole && !isSelf ? (
            <>
              <ActionButton variant="secondary" className="w-full justify-start px-3 py-1.5 text-xs" type="button" onClick={() => onOpenCustomRoleModal(member)}>
                <Tag size={13} /> Custom Role
              </ActionButton>
              <ActionButton variant="secondary" className="w-full justify-start px-3 py-1.5 text-xs" type="button" onClick={() => onOpenRoleModal(member)}>
                <UserCog size={13} /> Change Role
              </ActionButton>
            </>
          ) : null}
          <ActionButton
            variant="danger"
            className="w-full justify-start px-3 py-1.5 text-xs"
            disabled={!!isSelf || firingFor === memberId}
            type="button"
            onClick={() => onRequestFire(member)}
          >
            <UserMinus size={13} /> {firingFor === memberId ? "Removing..." : "Fire"}
          </ActionButton>
        </div>
      </div>
    </motion.li>
  );
}
