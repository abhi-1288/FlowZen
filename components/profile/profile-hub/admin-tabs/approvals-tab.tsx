import { useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord, displayNested, EmptyState, SectionHeader } from "../shared";
import { Modal } from "../modal";
import dynamic from "next/dynamic";

const IdCardModal = dynamic(
  () => import("../id-card-modal").then((mod) => mod.IdCardModal),
  { ssr: false },
);

function requestIdOf(request: AnyRecord) {
  const value = request.id ?? request._id;
  return value ? String(value) : "";
}

function getDefaultSalaryAmount(request: AnyRecord) {
  if (String(request.kind ?? "") !== "company") return "";
  const meta = (request.metadata ?? {}) as AnyRecord;
  const offeredCTC = Number(meta.offeredCTC ?? 0);
  return offeredCTC > 0 ? String(offeredCTC) : "";
}

function getDefaultSalaryPeriod(request: AnyRecord) {
  if (String(request.kind ?? "") !== "company") return "monthly" as const;
  const meta = (request.metadata ?? {}) as AnyRecord;
  return String(meta.salaryType ?? "") === "per-annum" ? ("yearly" as const) : ("monthly" as const);
}

function generateFallbackLetter(request: AnyRecord) {
  const metadata = (request.metadata ?? {}) as Record<string, unknown>;
  const letterType = String(metadata.letterType ?? "");
  const purpose = String(metadata.purpose ?? "");
  const customType = String(metadata.customType ?? "");

  if (letterType === "resignation") {
    const lastDayStr = metadata.resignationLastWorkingDay ? new Date(String(metadata.resignationLastWorkingDay)).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "[Date]";
    const reasonStr = purpose ? `\n\nReason for resignation: ${purpose}` : "";
    return `Dear HR,\n\nPlease accept this letter as formal notification that I am resigning from my position. As per my notice period, my last working day will be ${lastDayStr}.${reasonStr}\n\nThank you for the opportunities I've had during my time with the company. I wish the company continued success in the future.\n\nSincerely,\n`;
  } else if (letterType === "internship") {
    const startStr = metadata.internshipStart ? new Date(String(metadata.internshipStart)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "[Start Date]";
    const endStr = metadata.internshipEnd ? new Date(String(metadata.internshipEnd)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "[End Date]";
    const title = String(metadata.projectTitle ?? "");
    const desc = String(metadata.projectDescription ?? "");
    const achievements = String(metadata.projectAchievements ?? "");

    return `Dear HR,\n\nI am writing to formally request an Internship Certificate for my work from ${startStr} to ${endStr}.\n\nDuring this time, I worked on the project "${title}". ${desc}\n${achievements ? `\nKey achievements: ${achievements}\n` : ""}\nPurpose of request: ${purpose}\n\nPlease let me know if you need any further information.\n\nSincerely,\n`;
  } else {
    const typeLabel = letterType === "other" && customType ? customType : (letterType.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Document Letter");
    return `Dear HR,\n\nI am writing to formally request a ${typeLabel}.\n\nPurpose of request: ${purpose}\n\nPlease let me know if you need any further information from my side to process this request.\n\nSincerely,\n`;
  }
}

function quitNoticeInfo(request: AnyRecord) {
  if (String(request.kind) === "quit-company-board-transfer") {
    return { noticeDays: 0, elapsedDays: 0, remainingDays: 0, canApprove: true };
  }
  if (!String(request.kind ?? "").startsWith("quit-")) return null;
  const noticeDays = Number((request.company as AnyRecord | undefined)?.noticePeriodDays ?? 0);
  if (!Number.isFinite(noticeDays) || noticeDays <= 0) {
    return { noticeDays: 0, elapsedDays: 0, remainingDays: 0, canApprove: true };
  }
    const createdAt = request.createdAt ? new Date(request.createdAt as string) : new Date();
  const elapsedDays = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, noticeDays - elapsedDays);
  return { noticeDays, elapsedDays, remainingDays, canApprove: remainingDays === 0 };
}

export function ApprovalsTab({
  approvals,
  refresh,
  showToast,
}: {
  approvals: AnyRecord[];
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [decidingIds, setDecidingIds] = useState<Record<string, boolean>>({});
  const [clearedIds, setClearedIds] = useState<Record<string, boolean>>({});
  const [salaryAmounts, setSalaryAmounts] = useState<Record<string, string>>({});
  const [approvalSalaryPeriod, setApprovalSalaryPeriod] = useState<Record<string, "monthly" | "yearly">>({});
  const [approvalSalaryCurrency, setApprovalSalaryCurrency] = useState<Record<string, string>>({});
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [viewingLetter, setViewingLetter] = useState<AnyRecord | null>(null);
  const [letterContentDraft, setLetterContentDraft] = useState("");
  const [idCardPreviewRequest, setIdCardPreviewRequest] = useState<AnyRecord | null>(null);
  const { data: session } = useSession();

  function currencySymbol(cur: string) {
    return cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur === "JPY" ? "¥" : "₹";
  }

  async function decide(
    id: string,
    status: "approved" | "rejected",
    force = false,
    requestKind?: string,
    reason?: string,
    letterContent?: string,
  ) {
    if (!id) return;
    const isSalaryKind = ["salary", "company"].includes(String(requestKind ?? ""));
    const salaryRequest = isSalaryKind ? approvals.find((r) => requestIdOf(r) === id) : null;
    const salaryAmount = isSalaryKind
      ? (() => {
          const raw = Number(salaryAmounts[id] ?? (salaryRequest ? getDefaultSalaryAmount(salaryRequest) : 0));
          const period = approvalSalaryPeriod[id] ?? (salaryRequest ? getDefaultSalaryPeriod(salaryRequest) : "monthly");
          return period === "yearly" ? Math.round(raw / 12) : Math.max(0, raw);
        })()
      : undefined;
    const salaryCurrency = isSalaryKind ? (approvalSalaryCurrency[id] || "INR") : undefined;
    setDecidingIds((current) => ({ ...current, [id]: true }));
    try {
      await apiFetch(`/api/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, force, salaryAmount, salaryCurrency, reason, letterContent }),
      });
      setClearedIds((current) => ({ ...current, [id]: true }));
      showToast(`Request ${status}${force ? " (forced)" : ""}.`);
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : `Could not ${status === "approved" ? "approve" : "decline"} request.`,
        "error",
      );
    } finally {
      setDecidingIds((current) => ({ ...current, [id]: false }));
    }
  }

  async function approveWithSign(id: string) {
    if (!id) return;
    setDecidingIds((current) => ({ ...current, [id]: true }));
    try {
      await apiFetch(`/api/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved", signed: true }),
      });
      setClearedIds((current) => ({ ...current, [id]: true }));
      setIdCardPreviewRequest(null);
      showToast("ID Card approved and signed.");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not approve ID card request.",
        "error",
      );
    } finally {
      setDecidingIds((current) => ({ ...current, [id]: false }));
    }
  }

  const visibleApprovals = approvals.filter(
    (request) => !clearedIds[requestIdOf(request)],
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Pending Approvals" description="Review and manage approval requests" accent="indigo" />
      <div className="mt-5 divide-y divide-slate-200">
        {visibleApprovals.map((request) => {
          const requestId = requestIdOf(request);
          const isDeciding = Boolean(decidingIds[requestId]);
          const metadata = (request.metadata ?? {}) as AnyRecord;
          return (
            <div className="flex flex-wrap items-center justify-between gap-4 py-4" key={requestId}>
              <div>
                <p className="font-medium">
                  {displayNested(request.requester, "name", "User")},{" "}
                  {displayNested(request.requester, "role", "User")}
                </p>
                <p className="text-sm text-slate-500">
                  {displayNested(request.requester, "email", "unknown")}{" "}
                  {String(request.kind) === "quit-company-board-transfer"
                    ? "requested board transfer approval"
                    : String(request.kind) === "role-transfer"
                      ? "requested role transfer"
                      : String(request.kind).startsWith("quit-")
                        ? "requested to quit"
                        : String(request.kind) === "identity-code"
                          ? "requested a unique identity code"
                          : String(request.kind) === "salary"
                            ? "requested salary assignment"
                            : String(request.kind) === "salary-increment"
                              ? `requested salary update for ${metadata.targetUserName || "a member"}`
                              : request.kind === "document-letter"
                                ? `requested a ${String((request.metadata as AnyRecord)?.letterType ?? "document").replace(/-/g, " ")} letter`
                                : request.kind === "region-address"
                                  ? `submitted a new office address "${String((request.metadata as AnyRecord)?.label ?? "")}"`
                                  : request.kind === "id-card"
                                    ? "requested an ID card"
                                    : "requested to join"}{" "}
                  {String(request.kind) === "identity-code"
                    ? displayNested(request.company, "name", "company")
                    : String(request.kind) === "salary-increment"
                      ? ""
                      : request.kind === "team" || request.kind === "quit-team"
                        ? displayNested(request.team, "name", "team")
                        : displayNested(request.company, "name", "company")}
                </p>
                {String(request.kind) === "quit-company-board-transfer" ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {String(request.message ?? "").trim() || "Board transfer approval pending."}
                  </p>
                ) : String(request.kind) === "role-transfer" ? (
                  <p className="mt-1 text-xs text-slate-500">Role transfer approval pending.</p>
                ) : String(request.kind) === "document-letter" ? (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p>Purpose: {String((request.metadata as AnyRecord)?.purpose ?? "")}</p>
                    {String((request.metadata as AnyRecord)?.letterType ?? "") === "resignation" ? (
                      <>
                        <p>Last working day: {String((request.metadata as AnyRecord)?.resignationLastWorkingDay ?? "")}</p>
                        <p>Notice period: {String((request.metadata as AnyRecord)?.noticePeriodDays ?? "")} days</p>
                      </>
                    ) : null}
                  </div>
                ) : String(request.kind).startsWith("quit-") ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {(() => {
                      const info = quitNoticeInfo(request);
                      if (!info || info.noticeDays <= 0) return "No notice period set.";
                      return `Notice period: ${info.noticeDays} days. Pending: ${info.elapsedDays} days. Remaining: ${info.remainingDays} days.`;
                    })()}
                  </p>
                ) : null}
                {request.kind === "quit-company" && request.replacementHr ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Replacement HR: {displayNested(request.replacementHr, "name", "HR")}
                  </p>
                ) : null}
                {request.replacementUser ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Replacement: {displayNested(request.replacementUser, "name", "Member")}
                  </p>
                ) : null}
                {request.kind === "region-address" ? (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p>Region: {String((request.metadata as AnyRecord)?.label ?? "")}</p>
                    <p>Address: {String((request.metadata as AnyRecord)?.line1 ?? "")}, {String((request.metadata as AnyRecord)?.city ?? "")}, {String((request.metadata as AnyRecord)?.state ?? "")} {String((request.metadata as AnyRecord)?.zip ?? "")}</p>
                    <p>Country: {String((request.metadata as AnyRecord)?.country ?? "")}</p>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                {String(request.kind) === "document-letter" ? (
                  <ActionButton variant="secondary" className="px-3" disabled={isDeciding}
                    onClick={() => {
                      setViewingLetter(request);
                      const savedDraft = String((request.metadata as AnyRecord)?.letterContent ?? "").trim();
                      setLetterContentDraft(savedDraft ? savedDraft : generateFallbackLetter(request));
                    }}
                  >
                    Preview & Edit
                  </ActionButton>
                ) : null}
                {request.kind === "id-card" ? (
                  <ActionButton variant="secondary" className="px-3" disabled={isDeciding}
                    onClick={() => setIdCardPreviewRequest(request)}
                  >
                    Preview ID Card
                  </ActionButton>
                ) : null}
                <ActionButton variant="danger" className="px-3" disabled={isDeciding}
                  onClick={() => {
                    if (String(request.kind ?? "") === "document-letter" || request.kind === "id-card") {
                      setRejectModalId(requestId);
                      setRejectionReason("");
                    } else {
                      decide(requestId, "rejected", false, String(request.kind ?? ""));
                    }
                  }}
                >
                  {isDeciding ? "Working..." : "Decline"}
                </ActionButton>
                {["company", "salary"].includes(String(request.kind ?? "")) ? (
                  <div className="flex items-center gap-2">
                    <select className="rounded-lg border border-slate-200 bg-white px-1.5 py-2 text-xs"
                      value={approvalSalaryCurrency[requestId] ?? "INR"}
                      onChange={(e) => setApprovalSalaryCurrency((a) => ({ ...a, [requestId]: e.target.value }))}
                    >
                      <option value="INR">&#x20B9; INR</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">&#x20AC; EUR</option>
                      <option value="GBP">&#xA3; GBP</option>
                      <option value="JPY">&#xA5; JPY</option>
                    </select>
                    <div className="flex rounded-lg border border-slate-200">
                      <button type="button"
                        className={`rounded-l-lg px-2 py-2 text-xs font-medium transition ${(approvalSalaryPeriod[requestId] ?? getDefaultSalaryPeriod(request)) === "monthly" ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:text-slate-900"}`}
                        onClick={() => setApprovalSalaryPeriod((a) => ({ ...a, [requestId]: "monthly" }))}
                      >/month</button>
                      <button type="button"
                        className={`rounded-r-lg px-2 py-2 text-xs font-medium transition ${(approvalSalaryPeriod[requestId] ?? getDefaultSalaryPeriod(request)) === "yearly" ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:text-slate-900"}`}
                        onClick={() => setApprovalSalaryPeriod((a) => ({ ...a, [requestId]: "yearly" }))}
                      >/year</button>
                    </div>
                    <input className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-sm" placeholder="Amount" type="number" min={0}
                      value={salaryAmounts[requestId] ?? getDefaultSalaryAmount(request)}
                      onChange={(e) => setSalaryAmounts((a) => ({ ...a, [requestId]: e.target.value }))}
                    />
                    {Number(salaryAmounts[requestId] ?? getDefaultSalaryAmount(request)) > 0 ? (
                      <span className="text-xs text-slate-500">
                        {(approvalSalaryPeriod[requestId] ?? getDefaultSalaryPeriod(request)) === "yearly"
                          ? `≈${currencySymbol(approvalSalaryCurrency[requestId] || "INR")}${Math.round(Number(salaryAmounts[requestId] ?? getDefaultSalaryAmount(request)) / 12).toLocaleString("en-IN")}/mo`
                          : `≈${currencySymbol(approvalSalaryCurrency[requestId] || "INR")}${(Number(salaryAmounts[requestId] ?? getDefaultSalaryAmount(request)) * 12).toLocaleString("en-IN")}/yr`}
                      </span>
                    ) : null}
                    <ActionButton variant="approve" className="px-3"
                      disabled={isDeciding || (String(request.kind ?? "") === "salary" && !(Number(salaryAmounts[requestId] ?? 0) > 0))}
                      onClick={() => decide(requestId, "approved", false, String(request.kind ?? ""))}
                    >
                      {isDeciding ? "Working..." : "Approve"}
                    </ActionButton>
                  </div>
                ) : String(request.kind ?? "") === "salary-increment" ? (
                  <ActionButton variant="approve" className="px-3" disabled={isDeciding}
                    onClick={() => decide(requestId, "approved", false, String(request.kind ?? ""))}
                  >
                    {isDeciding ? "Working..." : "Approve Update"}
                  </ActionButton>
                ) : (
                  <ActionButton variant="approve" className="px-3"
                    disabled={(() => {
                      const info = quitNoticeInfo(request);
                      return isDeciding || (!!info && !info.canApprove);
                    })()}
                    onClick={() => decide(requestId, "approved", false, String(request.kind ?? ""))}
                  >
                    {isDeciding ? "Working..." : "Approve"}
                  </ActionButton>
                )}
                {String(request.kind).startsWith("quit-") ? (
                  <button
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                    disabled={isDeciding}
                    onClick={() => decide(requestId, "approved", true, String(request.kind ?? ""))}
                    type="button"
                  >
                    Force accept
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {visibleApprovals.length === 0 ? (
          <EmptyState message="No pending approvals." />
        ) : null}
      </div>

      <Modal open={!!rejectModalId} onClose={() => setRejectModalId(null)} title="Rejection Reason"
        description="Provide a reason for declining this request." maxWidth="max-w-md"
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setRejectModalId(null)}>Cancel</ActionButton>
            <ActionButton variant="danger" disabled={!rejectionReason.trim()} onClick={() => {
              if (rejectModalId) {
                decide(rejectModalId, "rejected", false, "document-letter", rejectionReason.trim());
                setRejectModalId(null);
              }
            }}>Reject</ActionButton>
          </>
        }
      >
        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={3}
          placeholder="e.g., Insufficient documentation, request doesn't meet company policy..."
          value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
        />
      </Modal>

      <Modal open={!!viewingLetter} onClose={() => setViewingLetter(null)} title="Review & Edit Letter"
        description={viewingLetter ? `${String((viewingLetter.metadata as AnyRecord)?.requesterName ?? (viewingLetter.requester as AnyRecord)?.name ?? "Employee")} · ${String((viewingLetter.metadata as AnyRecord)?.requesterRole ?? (viewingLetter.requester as AnyRecord)?.role ?? "")}` : undefined}
        maxWidth="max-w-4xl"
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setViewingLetter(null)}>Cancel</ActionButton>
            <ActionButton variant="danger" onClick={() => {
              if (viewingLetter) {
                setRejectModalId(String(viewingLetter.id ?? viewingLetter._id ?? ""));
                setRejectionReason("");
                setViewingLetter(null);
              }
            }}>Reject Request</ActionButton>
            <ActionButton variant="primary" onClick={() => {
              if (viewingLetter) {
                decide(String(viewingLetter.id ?? viewingLetter._id ?? ""), "approved", false, "document-letter", undefined, letterContentDraft);
                setViewingLetter(null);
              }
            }}>Approve & Save Letter</ActionButton>
          </>
        }
      >
        <textarea className="w-full min-h-[50vh] rounded-lg border border-slate-200 p-4 text-sm leading-relaxed text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={letterContentDraft} onChange={(e) => setLetterContentDraft(e.target.value)}
          placeholder="Draft empty or not provided."
        />
      </Modal>

      {idCardPreviewRequest ? (
        <IdCardModal
          open={!!idCardPreviewRequest}
          onClose={() => setIdCardPreviewRequest(null)}
          profile={{
            ...((idCardPreviewRequest.metadata as AnyRecord) ?? {}),
            phone: (idCardPreviewRequest.metadata as AnyRecord)?.userPhone,
            email: (idCardPreviewRequest.metadata as AnyRecord)?.userEmail,
            avatarUrl: (idCardPreviewRequest.metadata as AnyRecord)?.userAvatar,
            bloodGroup: (idCardPreviewRequest.metadata as AnyRecord)?.userBloodGroup,
            emergencyContact: (idCardPreviewRequest.metadata as AnyRecord)?.userEmergencyContact,
            regionLabel: (idCardPreviewRequest.metadata as AnyRecord)?.userRegionLabel,
            companyIdentityCode: (idCardPreviewRequest.metadata as AnyRecord)?.userIdentityCode,
          }}
          company={idCardPreviewRequest.company as AnyRecord}
          avatarUrl={String((idCardPreviewRequest.metadata as AnyRecord)?.userAvatar ?? "")}
          displayName={String((idCardPreviewRequest.metadata as AnyRecord)?.userName ?? (idCardPreviewRequest.requester as AnyRecord)?.name ?? "")}
          displayRole={String((idCardPreviewRequest.metadata as AnyRecord)?.userRole ?? (idCardPreviewRequest.requester as AnyRecord)?.role ?? "")}
          onSign={() => approveWithSign(requestIdOf(idCardPreviewRequest))}
          signerName={session?.user?.name ?? ""}
          signerRole={session?.user?.role ?? ""}
        />
      ) : null}
    </section>
  );
}
