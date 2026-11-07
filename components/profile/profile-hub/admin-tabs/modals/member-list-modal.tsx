import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Search, SearchX, X } from "lucide-react";
import * as XLSX from "xlsx";
import { AnyRecord, formatRole, formatRoleWithCustom } from "../../shared";
import { currencySymbol } from "../helpers";
import { effectiveRegionLabelOf, withMainOfficeSuffix } from "@/lib/company-regions";
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

  const filteredMembers = useMemo(() => {
    const query = modalSearchQuery.toLowerCase().trim();
    if (!query) return modalMembers;
    return modalMembers.filter((m) => {
      const name = String(m.name ?? "").toLowerCase();
      const email = String(m.email ?? "").toLowerCase();
      const code = String(m.companyIdentityCode ?? "").toLowerCase();
      const codeNum = code.split("-").pop() ?? "";
      return name.includes(query) || email.includes(query) || code.includes(query) || codeNum.includes(query);
    });
  }, [modalMembers, modalSearchQuery]);

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
        withMainOfficeSuffix(company, effectiveRegionLabelOf(company, m)),
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

  const modalTitle = modalRole
    ? modalRole === "all"
      ? "All members"
      : modalRole === "senior-security"
        ? "Senior Security"
        : modalRole === "junior-security"
          ? "Junior Security"
          : formatRole(modalRole)
    : "";

  return (
    <AnimatePresence>
      {modalRole ? (
        <motion.div
          key="member-list-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="max-h-[min(90vh,720px)] w-full max-w-3xl overflow-hidden rounded-2xl neu-card dark:border-zinc-800 dark:bg-[#000000]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="members-modal-title"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 border-b border-[var(--c-border-light)] px-6 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Search size={17} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100" id="members-modal-title">{modalTitle}</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {filteredMembers.length} member{filteredMembers.length === 1 ? "" : "s"}
                    {modalSearchQuery.trim() && filteredMembers.length !== modalMembers.length
                      ? ` · filtered from ${modalMembers.length}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <motion.button
                  type="button"
                  onClick={exportToExcel}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-1.5 rounded-lg neu-card px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] hover:text-slate-800 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Download size={14} />
                  Export Excel
                </motion.button>
                <button
                  aria-label="Close"
                  className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  type="button"
                  onClick={onClose}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {modalRole === "others" ? (
              <div className="flex items-center justify-between gap-4 border-b border-[var(--c-border-light)] px-6 py-3 dark:border-zinc-800">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500" htmlFor="others-role-filter">
                  Filter others by label
                </label>
                <select
                  id="others-role-filter"
                  className="max-w-[220px] flex-1 rounded-lg neu-inset px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-100"
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

            {/* ── Live search ── */}
            <div className="px-6 pt-4">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  value={modalSearchInput}
                  onChange={(e) => onSearchInputChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
                  placeholder="Search by name, email or ID number…"
                  className="neu-inset w-full rounded-lg py-2 pl-9 pr-8 text-xs dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                {modalSearchInput ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => onSearchInputChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            </div>

            {/* ── List ── */}
            <div className="max-h-[min(55vh,420px)] overflow-y-auto px-6 py-4">
              {filteredMembers.length === 0 ? (
                <div className="grid min-h-[190px] place-items-center text-center">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] text-slate-400 dark:text-zinc-500">
                      <SearchX size={22} />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-600 dark:text-zinc-300">No members match your search.</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">Try a name, email or the ID number.</p>
                  </div>
                </div>
              ) : (
                <motion.ul
                  className="space-y-4"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.05 } },
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredMembers.map((member) => (
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
                </motion.ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
