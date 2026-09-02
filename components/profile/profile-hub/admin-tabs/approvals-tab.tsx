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

type SalaryPeriod = "monthly" | "yearly" | "daily" | "hourly";

function getDefaultSalaryPeriod(request: AnyRecord): SalaryPeriod {
  if (String(request.kind ?? "") !== "company") return "monthly";
  const meta = (request.metadata ?? {}) as AnyRecord;
  const salaryType = String(meta.salaryType ?? "");
  if (salaryType === "per-annum") return "yearly";
  if (salaryType === "per-day") return "daily";
  if (salaryType === "per-hour") return "hourly";
  return "monthly";
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
  const [approvalSalaryPeriod, setApprovalSalaryPeriod] = useState<Record<string, SalaryPeriod>>({});
  const [approvalSalaryCurrency, setApprovalSalaryCurrency] = useState<Record<string, string>>({});
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [idCardPreviewRequest, setIdCardPreviewRequest] = useState<AnyRecord | null>(null);
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<AnyRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approvalEmploymentType, setApprovalEmploymentType] = useState<Record<string, string>>({});
  const [approvalEmploymentEndDate, setApprovalEmploymentEndDate] = useState<Record<string, string>>({});
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
    const salaryPeriod = isSalaryKind
      ? approvalSalaryPeriod[id] ?? (salaryRequest ? getDefaultSalaryPeriod(salaryRequest) : "monthly")
      : undefined;
    const salaryAmount = isSalaryKind
      ? salaryPeriod === "yearly"
        ? Math.round(Number(salaryAmounts[id] ?? (salaryRequest ? getDefaultSalaryAmount(salaryRequest) : 0)) / 12)
        : Math.max(0, Number(salaryAmounts[id] ?? (salaryRequest ? getDefaultSalaryAmount(salaryRequest) : 0)))
      : undefined;
    const salaryCurrency = isSalaryKind
      ? (approvalSalaryCurrency[id] || String(((salaryRequest?.metadata as AnyRecord) ?? {}).currency || "INR"))
      : undefined;
    setDecidingIds((current) => ({ ...current, [id]: true }));
    try {
      await apiFetch(`/api/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status, force, salaryAmount, salaryCurrency,
          salaryType: requestKind === "company" ? salaryPeriod : undefined,
          employmentType: requestKind === "employment-type" ? (approvalEmploymentType[id] ?? "") : undefined,
          employmentEndDate: requestKind === "employment-type" ? (approvalEmploymentEndDate[id] ?? null) : undefined,
          reason, letterContent,
        }),
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

  async function openDetail(id: string) {
    if (!id) return;
    setDetailRequestId(id);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await apiFetch<AnyRecord>(`/api/approvals/${id}/detail`);
      setDetailData(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not load onboarding details.", "error");
      setDetailRequestId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function periodLabel(salaryType: string) {
    if (salaryType === "per-month") return "/month";
    if (salaryType === "per-day") return "/day";
    if (salaryType === "per-hour") return "/hr";
    return "/yr";
  }

  function fmtSalary(amount: number, currency: string) {
    const sym = currencySymbol(currency || "INR");
    return `${sym}${Number(amount || 0).toLocaleString("en-IN")}`;
  }

  return (
    <section className="rounded-xl neu-card p-5">
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
                                  : request.kind === "employment-type"
                                    ? "requested an employment type"
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
                ) : request.kind === "employment-type" ? (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p>Requested type: {String((request.metadata as AnyRecord)?.employmentType ?? "").replace(/-/g, " ") || "-"}</p>
                    {String((request.metadata as AnyRecord)?.employmentEndDate ?? "") ? (
                      <p>End date: {new Date(String((request.metadata as AnyRecord)?.employmentEndDate)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                {String(request.kind) === "document-letter" ? (
                  <ActionButton variant="secondary" className="px-3" disabled={isDeciding}
                    onClick={() => window.open(`/letter/${requestId}?draft=1`, "_blank")}
                  >
                    Preview
                  </ActionButton>
                ) : null}
                {request.kind === "id-card" ? (
                  <ActionButton variant="secondary" className="px-3" disabled={isDeciding}
                    onClick={() => setIdCardPreviewRequest(request)}
                  >
                    Preview ID Card
                  </ActionButton>
                ) : null}
                {String(request.kind ?? "") === "company" && metadata.convertedFromCandidate ? (
                  <ActionButton variant="secondary" className="px-3" disabled={isDeciding || detailLoading}
                    onClick={() => openDetail(requestId)}
                  >
                    Detail
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
                    <select className="rounded-md neu-inset px-1.5 py-1.5 text-[11px]"
                      value={approvalSalaryCurrency[requestId] ?? String(metadata.currency || "INR")}
                      onChange={(e) => setApprovalSalaryCurrency((a) => ({ ...a, [requestId]: e.target.value }))}
                    >
                      <option value="INR">&#x20B9; INR</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">&#x20AC; EUR</option>
                      <option value="GBP">&#xA3; GBP</option>
                      <option value="JPY">&#xA5; JPY</option>
                    </select>
                    <div className="flex rounded-md border border-[var(--c-border-light)]">
                      {([
                        ["monthly", "/month"],
                        ["yearly", "/year"],
                        ["daily", "/day"],
                        ["hourly", "/hr"],
                      ] as [SalaryPeriod, string][]).map(([period, label], idx) => (
                        <button key={period} type="button"
                          className={`px-2 py-1.5 text-[11px] font-medium transition ${idx === 0 ? "rounded-l-md" : ""} ${idx === 3 ? "rounded-r-md" : ""} ${(approvalSalaryPeriod[requestId] ?? getDefaultSalaryPeriod(request)) === period ? "neu-tab-pressed" : "bg-[var(--c-bg-elevated)] text-slate-600 hover:text-slate-900"}`}
                          onClick={() => setApprovalSalaryPeriod((a) => ({ ...a, [requestId]: period }))}
                        >{label}</button>
                      ))}
                    </div>
                    <input className="w-24 rounded-md border border-[var(--c-border-light)] px-2 py-1.5 text-[11px]" placeholder="Amount" type="number" min={0}
                      value={salaryAmounts[requestId] ?? getDefaultSalaryAmount(request)}
                      onChange={(e) => setSalaryAmounts((a) => ({ ...a, [requestId]: e.target.value }))}
                    />
                    {Number(salaryAmounts[requestId] ?? getDefaultSalaryAmount(request)) > 0 ? (
                      <span className="text-xs text-slate-500">
                        {(() => {
                          const period = approvalSalaryPeriod[requestId] ?? getDefaultSalaryPeriod(request);
                          const raw = Number(salaryAmounts[requestId] ?? getDefaultSalaryAmount(request));
                          const sym = currencySymbol(approvalSalaryCurrency[requestId] || String(metadata.currency || "INR"));
                          if (period === "yearly") return `≈${sym}${Math.round(raw / 12).toLocaleString("en-IN")}/mo`;
                          if (period === "daily") return `≈${sym}${raw.toLocaleString("en-IN")}/day`;
                          if (period === "hourly") return `≈${sym}${raw.toLocaleString("en-IN")}/hr`;
                          return `≈${sym}${(raw * 12).toLocaleString("en-IN")}/yr`;
                        })()}
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
                ) : String(request.kind ?? "") === "employment-type" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="rounded-md neu-inset px-1.5 py-1.5 text-[11px]"
                      value={approvalEmploymentType[requestId] ?? String((metadata as AnyRecord)?.employmentType ?? "")}
                      onChange={(e) => setApprovalEmploymentType((a) => ({ ...a, [requestId]: e.target.value }))}
                    >
                      <option value="">— Choose type —</option>
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                    <input
                      type="date"
                      className="rounded-md border border-[var(--c-border-light)] px-2 py-1.5 text-[11px]"
                      value={approvalEmploymentEndDate[requestId] ?? String((metadata as AnyRecord)?.employmentEndDate ?? "").slice(0, 10)}
                      onChange={(e) => setApprovalEmploymentEndDate((a) => ({ ...a, [requestId]: e.target.value }))}
                    />
                    <ActionButton variant="approve" className="px-3"
                      disabled={isDeciding || !(approvalEmploymentType[requestId] ?? String((metadata as AnyRecord)?.employmentType ?? ""))}
                      onClick={() => decide(requestId, "approved", false, String(request.kind ?? ""))}
                    >
                      {isDeciding ? "Working..." : "Approve"}
                    </ActionButton>
                  </div>
                ) : String(request.kind ?? "") === "document-letter" ? null : (
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
        <textarea className="w-full rounded-md border border-[var(--c-border-light)] px-3 py-1.5 text-xs" rows={3}
          placeholder="e.g., Insufficient documentation, request doesn't meet company policy..."
          value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
        />
      </Modal>

      <Modal open={!!detailRequestId} onClose={() => setDetailRequestId(null)}
        title="Onboarding Detail" description="Candidate, job, interviews and offer for this join request" maxWidth="max-w-3xl"
        footer={
          <ActionButton variant="secondary" onClick={() => setDetailRequestId(null)}>Close</ActionButton>
        }
      >
        {detailLoading ? (
          <p className="text-sm text-slate-500">Loading details...</p>
        ) : detailData ? (
          <div className="space-y-5 text-sm">
            {(detailData.job || detailData.candidate) ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">Job</h4>
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const job = detailData.job as AnyRecord | null;
                    const cand = detailData.candidate as AnyRecord | null;
                    return (
                      <>
                        <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                          <p className="text-xs text-slate-500">Designation</p>
                          <p className="font-medium text-slate-900">{String(job?.title ?? cand?.designation ?? "-")}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                          <p className="text-xs text-slate-500">Department</p>
                          <p className="font-medium text-slate-900">{String(job?.department ?? "-")}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                          <p className="text-xs text-slate-500">Location</p>
                          <p className="font-medium text-slate-900">{String(job?.location ?? "-")}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                          <p className="text-xs text-slate-500">Employment Type</p>
                          <p className="font-medium text-slate-900">{String(job?.employmentType ?? "-")}</p>
                        </div>
                        {job && Number(job.salaryRangeMin ?? 0) > 0 ? (
                          <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                            <p className="text-xs text-slate-500">Salary Range</p>
                            <p className="font-medium text-slate-900">
                              {fmtSalary(Number(job.salaryRangeMin), String(job.currency))} - {fmtSalary(Number(job.salaryRangeMax), String(job.currency))}{periodLabel(String(job.salaryType ?? "per-annum"))}
                            </p>
                          </div>
                        ) : null}
                        <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                          <p className="text-xs text-slate-500">Stage</p>
                          <p className="font-medium text-slate-900">{String(cand?.stage ?? "-")}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                {detailData.job && String((detailData.job as AnyRecord).description ?? "").trim() ? (
                  <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                    <p className="text-xs text-slate-500">Job Description</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{String((detailData.job as AnyRecord).description)}</p>
                  </div>
                ) : null}
                {(() => {
                  const skills = detailData.job ? ((detailData.job as AnyRecord).requiredSkills as unknown) : [];
                  return Array.isArray(skills) && skills.length > 0 ? (
                    <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                      <p className="text-xs text-slate-500">Required Skills</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(skills as string[]).map((skill) => (
                          <span key={skill} className="rounded-full border border-[var(--c-border-light)] px-2 py-0.5 text-xs text-slate-700">{skill}</span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : null}

            {Array.isArray(detailData.interviews) && detailData.interviews.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">Interviews</h4>
                <div className="space-y-2">
                  {(detailData.interviews as AnyRecord[]).map((interview) => (
                    <div key={String(interview._id ?? interview.id)} className="rounded-lg border border-[var(--c-border-light)] p-3">
                      <p className="font-medium text-slate-900">
                        {String(interview.roundType ?? "-")} round
                        {interview.interviewer ? ` - ${displayNested(interview.interviewer, "name", "Interviewer")}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {interview.scheduledAt ? new Date(interview.scheduledAt as string).toLocaleString() : "Not scheduled"} · {String(interview.status ?? "-")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {detailData.offer ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">Offer</h4>
                <div className="rounded-lg border border-[var(--c-border-light)] p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Offer Letter</p>
                      <p className="font-medium text-slate-900">{String((detailData.offer as AnyRecord).designation ?? "-")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Offered CTC</p>
                      <p className="font-medium text-slate-900">
                        {fmtSalary(Number((detailData.offer as AnyRecord).offeredCTC), String((detailData.offer as AnyRecord).currency || "INR"))}{periodLabel(String((detailData.offer as AnyRecord).salaryType ?? "per-annum"))}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${String((detailData.offer as AnyRecord).status) === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {String((detailData.offer as AnyRecord).status ?? "-")}
                    </span>
                    {String((detailData.offer as AnyRecord)._id) ? (
                      <a
                        href={`/recruitment/offers/${String((detailData.offer as AnyRecord)._id)}/letter`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View Offer Letter →
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No offer found for this onboarding request.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No details available.</p>
        )}
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
