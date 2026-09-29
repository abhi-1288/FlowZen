"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { DOCUMENT_LETTER_APPROVER_ROLES } from "@/lib/company-regions";
import { MAX_LETTER_CO_APPROVERS } from "@/lib/document-letter-signatories";

type Props = {
  mode: "request" | "send";
  onClose: () => void;
  onSuccess: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
  isJuniorSecurity?: boolean;
};

type ApproverUser = {
  _id: string;
  name: string;
  email: string;
  regionLabel?: string;
};

const LETTER_TYPES = [
  { value: "experience", label: "Experience Certificate" },
  { value: "salary-certificate", label: "Salary Certificate" },
  { value: "offer-letter", label: "Offer Letter" },
  { value: "relieving", label: "Relieving Letter" },
  { value: "internship", label: "Internship Certificate" },
  { value: "resignation", label: "Resignation Letter" },
  { value: "final-settlement", label: "Final Settlement Letter" },
  { value: "form-16", label: "Form 16" },
  { value: "noc", label: "NOC Paper" },
  { value: "exit-agreement", label: "Exit Agreement" },
  { value: "employee-recognition", label: "Employee Recognition Letter" },
  { value: "other", label: "Other" },
  { value: "id-card", label: "ID Card" },
];

export function DocumentLetterModal({ mode, onClose, onSuccess, showToast, isJuniorSecurity = false }: Props) {
  const [letterType, setLetterType] = useState(mode === "send" ? "resignation" : "experience");
  const availableLetterTypes = LETTER_TYPES.filter(lt => mode === "send" ? lt.value === "resignation" : lt.value !== "resignation");
  const [customType, setCustomType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approvers, setApprovers] = useState<ApproverUser[]>([]);
  const [selectedHrId, setSelectedHrId] = useState("");
  const [coApprovers, setCoApprovers] = useState<ApproverUser[]>([]);
  const [coApproverIds, setCoApproverIds] = useState<string[]>([]);
  const [teamOwner, setTeamOwner] = useState<ApproverUser | null>(null);
  const [teamOwnerId, setTeamOwnerId] = useState("");
  const [teamOwnerBlockedReason, setTeamOwnerBlockedReason] = useState("");
  const [approverRegion, setApproverRegion] = useState("");
  const [regionFallback, setRegionFallback] = useState(false);
  const [internshipStart, setInternshipStart] = useState("");
  const [internshipEnd, setInternshipEnd] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectAchievements, setProjectAchievements] = useState("");
  const [resignationLastWorkingDay, setResignationLastWorkingDay] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [companyJoined, setCompanyJoined] = useState("");
  const [letterContent, setLetterContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const regionName = approverRegion.trim() ? `your region (${approverRegion.trim()})` : "your region";
  const totalCoApprovers = coApproverIds.length + (teamOwnerId ? 1 : 0);
  const atCoApproverCap = totalCoApprovers >= MAX_LETTER_CO_APPROVERS;
  // The team-owner suggestion is one-click only — it is never added for you.
  const canSuggestTeamOwner = Boolean(teamOwner) && !atCoApproverCap;
  // A team owner outside your region cannot be nominated, so the server would
  // drop it. Say so rather than offering a button that silently does nothing.
  const teamOwnerOutOfRegion = !teamOwner && teamOwnerBlockedReason === "out-of-region";
  // The approving HR already has a signature block, so they cannot also co-sign.
  const coApproverOptions = coApprovers.filter(
    (a) => a._id !== selectedHrId && a._id !== teamOwnerId,
  );

  function handlePreview() {
    if (letterType === "id-card") {
      setShowPreview(true);
      return;
    }
    if (letterType === "resignation" && !resignationLastWorkingDay) {
      showToast("Please enter the last working day first.", "error");
      return;
    }
    if (letterType === "internship" && (!internshipStart || !internshipEnd || !projectTitle || !projectDescription)) {
      showToast("Please fill in all required internship details first.", "error");
      return;
    }
    if (letterType === "other" && !customType.trim()) {
      showToast("Please enter a custom letter type first.", "error");
      return;
    }
    if (!purpose.trim()) {
      showToast("Please enter a purpose first.", "error");
      return;
    }

    if (!letterContent) {
      let content = "";
      if (letterType === "resignation") {
        const lastDayStr = new Date(resignationLastWorkingDay).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        const reasonStr = purpose ? `\n\nReason for resignation: ${purpose}` : "";
        content = `Dear HR,\n\nPlease accept this letter as formal notification that I am resigning from my position. As per my notice period, my last working day will be ${lastDayStr}.${reasonStr}\n\nThank you for the opportunities I've had during my time with the company. I wish the company continued success in the future.\n\nSincerely,\n`;
      } else if (letterType === "internship") {
        const startStr = new Date(internshipStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const endStr = new Date(internshipEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        content = `Dear HR,\n\nI am writing to formally request an Internship Certificate for my work from ${startStr} to ${endStr}.\n\nDuring this time, I worked on the project "${projectTitle}". ${projectDescription}\n${projectAchievements ? `\nKey achievements: ${projectAchievements}\n` : ""}\nPurpose of request: ${purpose}\n\nPlease let me know if you need any further information.\n\nSincerely,\n`;
      } else {
        const typeLabel = letterType === "other" ? customType : LETTER_TYPES.find(l => l.value === letterType)?.label || "Document Letter";
        content = `Dear HR,\n\nI am writing to formally request a ${typeLabel}.\n\nPurpose of request: ${purpose}\n\nPlease let me know if you need any further information from my side to process this request.\n\nSincerely,\n`;
      }
      setLetterContent(content);
    }
    setShowPreview(true);
  }

  useEffect(() => {
    // The primary approver is always HR (or senior security for junior security).
    const primaryUrl = isJuniorSecurity
      ? `/api/users?role=security&isSeniorSecurity=true&region=mine`
      : `/api/users?role=human-resource&region=mine`;
    // The optional co-approver can be any of the wider approver roles.
    // `regionFallback=main` keeps this picker on the same region rule the server
    // validates nominations with, so it can never offer someone it then rejects.
    const coUrl = `/api/users?role=${DOCUMENT_LETTER_APPROVER_ROLES.join(",")}&region=mine&regionFallback=main`;

    apiFetch<{ users: ApproverUser[]; region?: string; regionFallback?: boolean }>(primaryUrl)
      .then((res) => {
        setApprovers(res.users ?? []);
        setApproverRegion(res.region ?? "");
        setRegionFallback(Boolean(res.regionFallback));
        if (res.users?.length === 1) {
          setSelectedHrId(res.users[0]._id);
        }
      })
      .catch(() => {});

    if (!isJuniorSecurity) {
      apiFetch<{ users: ApproverUser[] }>(coUrl)
        .then((res) => setCoApprovers(res.users ?? []))
        .catch(() => {});
      apiFetch<{
        teamOwner?: { user?: string; name?: string; role?: string } | null;
        teamOwnerBlockedReason?: string;
      }>("/api/hr/document-letter?plan=1")
        .then((res) => {
          if (res.teamOwner?.user) {
            setTeamOwner({
              _id: String(res.teamOwner.user),
              name: String(res.teamOwner.name ?? ""),
              email: "",
            });
            setTeamOwnerBlockedReason("");
          } else {
            setTeamOwner(null);
            setTeamOwnerBlockedReason(String(res.teamOwnerBlockedReason ?? ""));
          }
        })
        .catch(() => {});
    }

    apiFetch<{ noticePeriodDays?: number; user?: { companyJoined?: string } }>("/api/profile")
      .then((res) => {
        if (res.noticePeriodDays) setNoticePeriodDays(res.noticePeriodDays);
        if (res.user?.companyJoined) setCompanyJoined(res.user.companyJoined);
      })
      .catch(() => {});
  }, [isJuniorSecurity]);

  useEffect(() => {
    if (letterType === "resignation" && noticePeriodDays > 0) {
      const earliest = new Date();
      earliest.setDate(earliest.getDate() + noticePeriodDays);
      setResignationLastWorkingDay(earliest.toISOString().slice(0, 10));
    }
  }, [letterType, noticePeriodDays]);

  async function handleSubmit() {
    if (letterType === "id-card") {
      try {
        setSubmitting(true);
        await apiFetch("/api/profile/id-card/request", {
          method: "POST",
          body: JSON.stringify({ adminId: selectedHrId || undefined }),
        });
        showToast("ID card request sent for approval.");
        onSuccess();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to send request.", "error");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!purpose.trim()) {
      showToast("Please enter a purpose.", "error");
      return;
    }
    if (letterType === "other" && !customType.trim()) {
      showToast("Please enter a custom letter type.", "error");
      return;
    }
    if (letterType === "internship") {
      if (!internshipStart || !internshipEnd) {
        showToast("Please enter the internship start and end dates.", "error");
        return;
      }
      if (new Date(internshipEnd) <= new Date(internshipStart)) {
        showToast("End date must be after start date.", "error");
        return;
      }
      if (!projectTitle.trim()) {
        showToast("Please enter a project title.", "error");
        return;
      }
      if (!projectDescription.trim()) {
        showToast("Please describe what the project does.", "error");
        return;
      }
    }
    if (letterType === "resignation") {
      if (!resignationLastWorkingDay) {
        showToast("Please enter the last working day.", "error");
        return;
      }
      const earliest = new Date();
      earliest.setDate(earliest.getDate() + noticePeriodDays);
      if (new Date(resignationLastWorkingDay) < earliest) {
        showToast(`Last working day must be at least ${noticePeriodDays} days from today (notice period).`, "error");
        return;
      }
    }

    try {
      setSubmitting(true);
      await apiFetch("/api/hr/document-letter", {
        method: "POST",
        body: JSON.stringify({
          letterType,
          purpose: purpose.trim(),
          customType: customType.trim(),
          approverId: selectedHrId || undefined,
          coApproverIds,
          teamOwnerId: teamOwnerId || undefined,
          internshipStart: letterType === "internship" ? internshipStart : undefined,
          internshipEnd: letterType === "internship" ? internshipEnd : undefined,
          projectTitle: letterType === "internship" ? projectTitle.trim() : undefined,
          projectDescription: letterType === "internship" ? projectDescription.trim() : undefined,
          projectAchievements: letterType === "internship" ? projectAchievements.trim() : undefined,
          resignationLastWorkingDay: letterType === "resignation" ? resignationLastWorkingDay : undefined,
          letterContent: letterContent.trim() ? letterContent.trim() : undefined,
        }),
      });
      showToast(mode === "send" ? "Resignation letter sent for approval." : "Document letter request sent for approval.");
      onSuccess();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit request.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl neu-card">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--c-border-light)] px-6 py-4">
          <div className="flex items-start gap-3">
            {showPreview ? (
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--c-border-light)] text-slate-500 hover:bg-[var(--c-bg-muted)]"
                type="button"
                onClick={() => setShowPreview(false)}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <div>
              <h4 className="text-lg font-semibold text-slate-900">
                {showPreview ? "Edit Letter Content" : mode === "send" ? "Send Resignation Letter" : "Request Document Letter"}
              </h4>
              <p className="mt-0.5 text-sm text-slate-500">
                {letterType === "id-card" ? "Request an ID card for approval." : showPreview ? "Customize the text before submitting." : mode === "send" ? `Submit your resignation letter to ${isJuniorSecurity ? "senior security" : "your region's approver"}.` : `Submit a request to ${isJuniorSecurity ? "senior security" : "your region's approver"} for a company document letter.`}
              </p>
            </div>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-[var(--c-bg-muted)]"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {showPreview ? (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Letter Content</label>
              <textarea
                className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                rows={12}
                value={letterContent}
                onChange={(e) => setLetterContent(e.target.value)}
              />
            </div>
          </div>
        ) : (
        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Letter Type
            </label>
            <select
              className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
              value={letterType}
              onChange={(e) => setLetterType(e.target.value)}
            >
              {availableLetterTypes.map((lt) => (
                <option key={lt.value} value={lt.value}>
                  {lt.label}
                </option>
              ))}
            </select>
          </div>

          {letterType === "id-card" ? (
            <p className="text-sm text-slate-600">{isJuniorSecurity ? "Select a senior security member to review and approve your ID card request." : "Select an HR to review and approve your ID card request."} No additional details are needed.</p>
          ) : null}

          {letterType === "employee-recognition" ? (
            <p className="text-sm text-slate-600">The employment period (from your joining date to your end date, or <em>Present</em> if currently employed) will be taken from your employment records.</p>
          ) : null}

          {letterType === "other" ? (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Custom Letter Type
              </label>
              <input
                className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                placeholder="e.g., Bonafide Certificate"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
              />
            </div>
          ) : null}

          {letterType === "internship" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    From Date
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                    value={internshipStart}
                    onChange={(e) => setInternshipStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    To Date
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                    value={internshipEnd}
                    onChange={(e) => setInternshipEnd(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                  placeholder="e.g., Task Management Dashboard"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  What does it do? <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Briefly describe what the project does"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Achievements
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                  rows={2}
                  placeholder="What did you achieve? (optional)"
                  value={projectAchievements}
                  onChange={(e) => setProjectAchievements(e.target.value)}
                />
              </div>
            </>
          ) : null}

          {letterType === "resignation" ? (
            <>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Last Working Day <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                  value={resignationLastWorkingDay}
                  onChange={(e) => setResignationLastWorkingDay(e.target.value)}
                  min={new Date(Date.now() + noticePeriodDays * 86400000).toISOString().slice(0, 10)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Notice period: {noticePeriodDays} days. Earliest last working day is{" "}
                  {new Date(Date.now() + noticePeriodDays * 86400000).toLocaleDateString("en-IN")}.
                </p>
              </div>
              {companyJoined ? (
                <p className="text-xs text-slate-500">
                  Joined company on: {new Date(companyJoined).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              ) : null}
            </>
          ) : null}

          {letterType !== "id-card" ? (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Purpose
              </label>
              <textarea
                className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
                rows={3}
                placeholder="e.g., For visa application, higher education, bank loan..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              {isJuniorSecurity ? "Assign to Senior Security" : "Approving HR"}
            </label>
            <select
              className="mt-1 w-full rounded-lg neu-inset px-3 py-2 text-sm"
              value={selectedHrId}
              onChange={(e) => setSelectedHrId(e.target.value)}
            >
              <option value="">Auto-assign</option>
              {approvers.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.email}){a?.regionLabel ? ` — ${a.regionLabel}` : "No-region"}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              {approvers.length === 0
                ? isJuniorSecurity
                  ? "No senior security members found. The request will be auto-assigned."
                  : "No HR found. The request will be auto-assigned."
                : regionFallback
                  ? `No HR in ${regionName} — showing all company HR.`
                  : approvers.length > 1
                    ? `Select a specific HR${regionName ? ` in ${regionName}` : ""} or leave as auto-assign.`
                    : `Only one HR is available${regionName ? ` in ${regionName}` : ""}.`}
              {!isJuniorSecurity ? " HR is always the required approver for a letter." : ""}
            </p>
            {letterType === "id-card" ? (
              <p className="mt-1 text-xs text-slate-400">
                The selected approver will review and approve your ID card request.
              </p>
            ) : null}
          </div>

          {letterType !== "id-card" && !isJuniorSecurity ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Optional co-approvers
                </label>
                <span className="text-[11px] text-slate-400">
                  {totalCoApprovers}/{MAX_LETTER_CO_APPROVERS}
                </span>
              </div>

              {teamOwnerId ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-2">
                  <p className="min-w-0 flex-1 truncate text-sm text-indigo-900">
                    {teamOwner?.name ?? "Team owner"}
                    <span className="ml-1 text-xs text-indigo-600">(Team Owner)</span>
                  </p>
                  <button
                    type="button"
                    aria-label="Remove team owner"
                    onClick={() => setTeamOwnerId("")}
                    className="rounded p-1 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}

              {coApproverIds.map((id) => {
                return (
                  <div key={id} className="mt-2 flex items-center gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-lg neu-inset px-3 py-2 text-sm"
                      value={id}
                      onChange={(e) =>
                        setCoApproverIds((current) =>
                          current.map((existing) => (existing === id ? e.target.value : existing)),
                        )
                      }
                    >
                      {coApproverOptions
                        .filter((a) => a._id === id || !coApproverIds.includes(a._id))
                        .map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.name} ({a.email}){a?.regionLabel ? ` — ${a.regionLabel}` : "No-region"}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Remove co-approver"
                      onClick={() =>
                        setCoApproverIds((current) => current.filter((existing) => existing !== id))
                      }
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={atCoApproverCap}
                  onClick={() => {
                    const next = coApproverOptions.find((a) => !coApproverIds.includes(a._id));
                    if (next) setCoApproverIds((current) => [...current, next._id]);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={13} />
                  {coApproverIds.length === 0 ? "Add a co-approver" : "Add another co-approver"}
                </button>

                {canSuggestTeamOwner && teamOwner ? (
                  <button
                    type="button"
                    onClick={() => setTeamOwnerId(teamOwner._id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    <Plus size={13} />
                    Add my team owner ({teamOwner.name})
                  </button>
                ) : null}

                {teamOwnerOutOfRegion ? (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-400">
                    Team owner unavailable — not in {regionName}
                  </span>
                ) : null}
              </div>

              {atCoApproverCap ? (
                <p className="mt-2 text-xs text-amber-600">
                  You have reached the maximum of {MAX_LETTER_CO_APPROVERS} co-approvers.
                </p>
              ) : null}
              {coApproverOptions.length === 0 && !teamOwnerId ? (
                <p className="mt-2 text-xs text-slate-400">
                  No eligible co-approvers found{regionName ? ` in ${regionName}` : ""}.
                </p>
              ) : null}

              <p className="mt-2 text-xs text-slate-400">
                Co-approvers are added only if you choose them. They can sign before or after HR
                approves, and their signature is optional — it never holds up or cancels the
                letter.
              </p>
            </div>
          ) : null}

          {letterType !== "id-card" ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePreview}
                className="w-full rounded-lg neu-inset px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-[var(--c-bg-muted)]"
              >
                {letterContent ? "Edit Letter Content" : "Preview & Edit Letter Content"}
              </button>
            </div>
          ) : null}
        </div>
        )}

        <div className="flex justify-end gap-3 border-t border-[var(--c-border-light)] px-6 py-4">
          {showPreview ? (
            <button
              className="neu-btn neu-btn-primary rounded-lg px-5 py-2 text-sm font-medium"
              type="button"
              onClick={() => setShowPreview(false)}
            >
              Done Editing
            </button>
          ) : (
            <>
              <button
                className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[var(--c-bg-muted)]"
                type="button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="neu-btn neu-btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:cursor-not-allowed"
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? "Submitting..." : (mode === "send" ? "Send Letter" : letterType === "id-card" ? "Request ID Card" : "Submit Request")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
