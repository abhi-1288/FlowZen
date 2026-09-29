import { useMemo } from "react";
import { X, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { AnyRecord, ActionButton, formatRole, formatRoleWithCustom } from "../../shared";
import { currencySymbol } from "../helpers";
import { withMainOfficeSuffix } from "@/lib/company-regions";
import { MemberCard } from "./member-card";

export function MemberListModal({
  modalRole,
  members,
  company,
  firingFor,
  canEditOthersRole,
  selfId,
  selectedOtherRole,
  otherRoleOptions,
  modalSearchInput,
  modalSearchQuery,
  onClose,
  onRequestFire,
  onOpenSalaryModal,
  onOpenPfEsicModal,
  onOpenDocModal,
  onOpenRoleModal,
  onOpenCustomRoleModal,
  onSearchInputChange,
  onSearch,
  onSelectedOtherRoleChange,
  showToast,
  onRefresh,
  regionOptions = [],
  onOpenRegionModal,
  onOpenEmploymentModal,
}: {
  modalRole: string | null;
  members: AnyRecord[];
  company: AnyRecord | null;
  firingFor: string | null;
  canEditOthersRole: boolean;
  selfId: string;
  selectedOtherRole: string;
  otherRoleOptions: string[];
  modalSearchInput: string;
  modalSearchQuery: string;
  onClose: () => void;
  onRequestFire: (member: AnyRecord) => void;
  onOpenSalaryModal: (member: AnyRecord) => void;
  onOpenPfEsicModal: (member: AnyRecord) => void;
  onOpenDocModal: (member: AnyRecord) => void;
  onOpenRoleModal: (member: AnyRecord) => void;
  onOpenCustomRoleModal: (member: AnyRecord) => void;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onSelectedOtherRoleChange: (role: string) => void;
  showToast: (text: string, type?: "success" | "error") => void;
  onRefresh?: (silent?: boolean) => Promise<void>;
  regionOptions?: string[];
  onOpenRegionModal?: (member: AnyRecord) => void;
  onOpenEmploymentModal?: (member: AnyRecord) => void;
}) {
  const modalMembers = useMemo(() => {
    if (!modalRole) return [];
    return members.filter((m) => {
      // "all" is the unfiltered tab senior security gets in place of the per-role
      // grid. It has to be matched before the strict role equality below, or every
      // member is filtered out and the tab opens empty.
      if (modalRole === "all") return true;
      if (modalRole === "senior-security") {
        return String(m.role) === "security" && Boolean((m as any).isSeniorSecurity);
      }
      if (modalRole === "junior-security") {
        return String(m.role) === "security" && !Boolean((m as any).isSeniorSecurity);
      }
      if (String(m.role ?? "") !== modalRole) return false;
      if (modalRole === "others" && selectedOtherRole !== "all") {
        return String(m.customRole ?? "").trim() === selectedOtherRole;
      }
      return true;
    });
  }, [modalRole, members, selectedOtherRole]);

  function exportToExcel() {
    const fmtDate = (val: unknown): string => {
      if (!val) return "";
      try { return new Date(String(val)).toLocaleDateString("en-IN"); } catch { return String(val); }
    };
    const header = [
      "Name", "Email", "Role", "Unique Code", "Region/Office",
      "Team(s)", "Base Salary", "Joining Date", "Leaving Date",
      "Phone", "Date of Birth", "Address", "Emergency Contact", "Blood Group",
    ];
    const rows = modalMembers.map((m) => {
      const teams = Array.isArray(m.teams) ? m.teams.map(String).join(", ") : "";
      const salary = Number(m.baseSalary ?? 0);
      const cur = String(m.salaryCurrency ?? "INR");
      const salaryDisplay = salary > 0 ? `${currencySymbol(cur)} ${salary.toLocaleString("en-IN")}` : "";
      return [
        String(m.name ?? ""),
        String(m.email ?? ""),
        formatRoleWithCustom(String(m.role ?? "employee"), m.customRole, Boolean(m.isSeniorSecurity)),
        String(m.companyIdentityCode ?? ""),
        withMainOfficeSuffix(company, String(m.regionLabel ?? "")),
        teams,
        salaryDisplay,
        fmtDate(m.companyJoined),
        fmtDate(m.leavingDate),
        String(m.phone ?? ""),
        fmtDate(m.dob),
        String(m.address ?? ""),
        String(m.emergencyContact ?? ""),
        String(m.bloodGroup ?? ""),
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [
      { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 20 },
      { wch: 20 }, { wch: 15 }, { wch: 14 }, { wch: 14 },
      { wch: 15 }, { wch: 14 }, { wch: 35 }, { wch: 15 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `members-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Excel file exported.", "success");
  }

  if (!modalRole) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-3xl overflow-hidden rounded-xl neu-card dark:border-zinc-800 dark:bg-[#000000]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-modal-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--c-border-light)] px-6 py-4 dark:border-zinc-800">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100" id="members-modal-title">{modalRole === "all" ? "All members" : modalRole === "senior-security" ? "Senior Security" : modalRole === "junior-security" ? "Junior Security" : formatRole(modalRole)}</h4>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {modalMembers.length} member{modalMembers.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={exportToExcel}
              className="inline-flex items-center gap-1.5 rounded-md neu-card px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] hover:text-slate-800 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Download size={14} />
              Export Excel
            </button>
            <button
              aria-label="Close"
              className="inline-flex items-center justify-center gap-2 rounded-md p-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 text-slate-500 hover:text-slate-700 hover:bg-[var(--c-bg-muted)] dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
              type="button"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {modalRole === "others" ? (
          <div className="border-b border-[var(--c-border-light)] px-6 py-4 dark:border-zinc-800">
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-500" htmlFor="others-role-filter">
              Filter others by label
            </label>
            <select
              id="others-role-filter"
              className="mt-2 w-full max-w-xs rounded-md neu-inset px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-100"
              value={selectedOtherRole}
              onChange={(e) => onSelectedOtherRoleChange(e.target.value)}
            >
              <option value="all">All others</option>
              {otherRoleOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="px-6 pt-4">
          <div className="flex gap-2">
            <input
              value={modalSearchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
              placeholder="Search members..."
              className="neu-inset flex-1 rounded-md px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <ActionButton variant="primary" onClick={onSearch}>Search</ActionButton>
          </div>
        </div>

        <div className="max-h-[min(55vh,420px)] overflow-y-auto px-6 py-4">
          {(() => {
            const query = modalSearchQuery.toLowerCase().trim();
            const filtered = query
              ? modalMembers.filter((m) => {
                  const name = String(m.name ?? "").toLowerCase();
                  const email = String(m.email ?? "").toLowerCase();
                  const code = String(m.companyIdentityCode ?? "").toLowerCase();
                  const codeNum = code.split("-").pop() ?? "";
                  return name.includes(query) || email.includes(query) || code.includes(query) || codeNum.includes(query);
                })
              : modalMembers;
            if (filtered.length === 0) {
              return <p className="py-8 text-center text-sm text-slate-500 dark:text-zinc-500">No members match your search.</p>;
            }
            return (
              <ul className="space-y-4">
                {filtered.map((member) => (
                  <MemberCard
                    key={String(member.id)}
                    member={member}
                    company={company}
                    selfId={selfId}
                    canEditOthersRole={canEditOthersRole}
                    firingFor={firingFor}
                    onRequestFire={onRequestFire}
                    onOpenSalaryModal={onOpenSalaryModal}
                    onOpenPfEsicModal={onOpenPfEsicModal}
                    onOpenDocModal={onOpenDocModal}
                    onOpenRoleModal={onOpenRoleModal}
                    onOpenCustomRoleModal={onOpenCustomRoleModal}
                    onOpenRegionModal={onOpenRegionModal}
                    onOpenEmploymentModal={onOpenEmploymentModal}
                    showToast={showToast}
                    onRefresh={onRefresh}
                  />
                ))}
              </ul>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
