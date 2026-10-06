import { useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { pendingSignatureSummary } from "@/lib/document-letter-signatories";
import { ActionButton, AnyRecord, displayNested, EmptyState, SectionHeader } from "../shared";
import { Modal } from "../modal";
import dynamic from "next/dynamic";

const IdCardModal = dynamic(
  () => import("../id-card-modal").then((mod) => mod.IdCardModal),
  { ssr: false },
);

/** Mirrors the `kind` enum on the JoinRequest model. */
type ApprovalKind =
  | "company"
  | "team"
  | "identity-code"
  | "salary"
  | "salary-advance"
  | "quit-company"
  | "quit-team"
  | "quit-company-board-transfer"
  | "salary-increment"
  | "role-transfer"
  | "document-letter"
  | "region-address"
  | "id-card"
  | "employment-type"
  | "identity-code-range"
  | "store-order";

type ApprovalGroup = "joining" | "resignation" | "documents" | "finance" | "hr-company" | "store";

/**
 * Exhaustive on purpose: adding a kind to the JoinRequest enum fails the build
 * here until it is assigned a group, so a new request type can never end up
 * visible only under "All".
 */
const KIND_TO_GROUP: Record<ApprovalKind, ApprovalGroup> = {
  company: "joining",
  team: "joining",
  "quit-company": "resignation",
  "quit-team": "resignation",
  "quit-company-board-transfer": "resignation",
  "role-transfer": "resignation",
  "document-letter": "documents",
  "id-card": "documents",
  salary: "finance",
  "salary-increment": "finance",
  "salary-advance": "finance",
  "identity-code": "hr-company",
  "identity-code-range": "hr-company",
  "region-address": "hr-company",
  "employment-type": "hr-company",
  "store-order": "store",
};

const GROUPS: { id: ApprovalGroup; label: string; empty: string }[] = [
  { id: "joining", label: "Joining", empty: "No pending joining requests." },
  { id: "resignation", label: "Resignation", empty: "No pending resignation requests." },
  { id: "documents", label: "Documents", empty: "No pending document requests." },
  { id: "finance", label: "Finance", empty: "No pending salary requests." },
  { id: "hr-company", label: "HR & Company", empty: "No pending HR or company requests." },
  { id: "store", label: "Store Orders", empty: "No pending store orders." },
];

function groupOf(request: AnyRecord): ApprovalGroup | null {
  return KIND_TO_GROUP[String(request.kind ?? "") as ApprovalKind] ?? null;
}

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
  // Document letters preview in a modal. `draft` mirrors the page's `?draft=1`
  // flag, needed for a letter HR has not approved yet, which the page refuses
  // to render otherwise.
  const [letterPreview, setLetterPreview] = useState<{ id: string; draft: boolean } | null>(null);
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
      if (requestKind === "store-order") {
        await apiFetch(`/api/store/orders/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status, reason }),
        });
        setClearedIds((current) => ({ ...current, [id]: true }));
        showToast(`Order ${status}${force ? " (forced)" : ""}.`);
        await refresh(true);
        return;
      }
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

  async function coSign(id: string, sign: boolean) {
    if (!id) return;
    setDecidingIds((current) => ({ ...current, [id]: true }));
    try {
      await apiFetch(`/api/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ sign }),
      });
      setClearedIds((current) => ({ ...current, [id]: true }));
      showToast(sign ? "Your signature has been added." : "Signature declined.");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not record your signature.",
        "error",
      );
    } finally {
      setDecidingIds((current) => ({ ...current, [id]: false }));
    }
  }

  const visibleApprovals = approvals.filter(
    (request) => !clearedIds[requestIdOf(request)],
  );

  const [activeGroup, setActiveGroup] = useState<"all" | ApprovalGroup>("all");

  const countsByGroup = visibleApprovals.reduce<Record<string, number>>((acc, request) => {
    const group = groupOf(request);
    if (group) acc[group] = (acc[group] ?? 0) + 1;
    return acc;
  }, {});
  const visibleGroups = GROUPS.filter((group) => (countsByGroup[group.id] ?? 0) > 0);

  // Zero-count tabs are hidden, so deciding the last request in the active tab
  // would otherwise strand the view on a tab that no longer exists. Derived
  // rather than synced in an effect so the fallback applies in the same render.
  const effectiveGroup: "all" | ApprovalGroup =
    activeGroup !== "all" && (countsByGroup[activeGroup] ?? 0) === 0 ? "all" : activeGroup;

  const groupedApprovals =
    effectiveGroup === "all"
      ? visibleApprovals
      : visibleApprovals.filter((request) => groupOf(request) === effectiveGroup);

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
      {visibleGroups.length > 1 ? (
        <div className="sticky top-0 z-10 -mx-5 mt-5 bg-[var(--c-bg-card)] px-5 pb-2">
          <div className="flex flex-wrap gap-2">
            {([
              { id: "all" as const, label: "All", count: visibleApprovals.length },
              ...visibleGroups.map((group) => ({
                id: group.id,
                label: group.label,
                count: countsByGroup[group.id] ?? 0,
              })),
            ]).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveGroup(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  effectiveGroup === tab.id
                    ? "bg-indigo-500 text-white"
                    : "bg-[var(--c-bg-muted)] text-slate-600 hover:bg-[var(--c-bg-hover)]"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-5 divide-y divide-slate-200">
        {groupedApprovals.map((request) => {
          const requestId = requestIdOf(request);
          const isDeciding = Boolean(decidingIds[requestId]);
          const metadata = (request.metadata ?? {}) as AnyRecord;
          // A co-approver can sign before HR issues the letter, so this only
          // decides whether the preview needs `?draft=1` to render at all.
          const signatureReady = (request as AnyRecord).signatureReady !== false;
          return (
            <div className="flex flex-wrap items-center justify-between gap-4 py-4" key={requestId}>
              <div>
                {(request as AnyRecord).signatoryView ? (
                  <p
                    className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      signatureReady
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {signatureReady ? "Your optional signature" : "Nominated to co-sign"}
                  </p>
                ) : null}
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
                          : String(request.kind) === "identity-code-range"
                            ? "requested an identity code range increase"
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
                                    : request.kind === "store-order"
                                      ? `requested store order ${metadata.orderNumber ?? ""}`
                                      : "requested to join"}{" "}
                  {String(request.kind) === "identity-code"
                    ? displayNested(request.company, "name", "company")
                    : String(request.kind) === "identity-code-range"
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
                    {(request as AnyRecord).signatoryView && !signatureReady ? (
                      <p className="text-slate-500">
                        HR has not approved this letter yet. Your signature is optional and will be
                        carried onto the letter when it is issued.
                      </p>
                    ) : null}
                    {pendingSignatureSummary((request as AnyRecord).signatories) ? (
                      <p className="font-medium text-indigo-600">
                        Awaiting optional signature: {pendingSignatureSummary((request as AnyRecord).signatories)}
                      </p>
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
                {request.kind === "store-order" ? (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p>
                      Order {String(metadata.orderNumber ?? "")} · {String(metadata.lineCount ?? 0)} line(s) ·{" "}
                      {String(metadata.itemCount ?? 0)} item(s)
                    </p>
                    {metadata.deliveryName ? (
                      <p>
                        Deliver to: {String(metadata.deliveryName)}
                        {metadata.department ? ` · ${String(metadata.department)}` : ""}
                      </p>
                    ) : null}
                    {Array.isArray(metadata.items) && metadata.items.length > 0 ? (
                      <p>
                        {metadata.items
                          .map((item: AnyRecord) => `${String(item.name ?? "")} × ${String(item.quantity ?? "")}`)
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
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
                ) : request.kind === "identity-code-range" ? (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p>Region: {String((request.metadata as AnyRecord)?.region ?? "")}</p>
                    <p>Range: {String((request.metadata as AnyRecord)?.currentEndRange ?? "")} &rarr; {String((request.metadata as AnyRecord)?.newEndRange ?? "")}</p>
                    <p>Requested by: {String((request.metadata as AnyRecord)?.requesterName ?? "") || displayNested(request.requester, "name", "Member")}</p>
                    <p className="font-medium text-amber-600">Only the main-office HR or admin can approve this.</p>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                {String(request.kind) === "document-letter" ? (
                  <ActionButton variant="secondary" className="px-3" disabled={isDeciding}
                    onClick={() => setLetterPreview({ id: requestId, draft: true })}
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
                {(request as AnyRecord).signatoryView ? (
                  <>
                    <ActionButton variant="secondary" className="px-3" disabled={isDeciding}
                      onClick={() => setLetterPreview({ id: requestId, draft: !signatureReady })}
                    >
                      View letter
                    </ActionButton>
                    <ActionButton variant="primary" className="px-3" disabled={isDeciding}
                      onClick={() => coSign(requestId, true)}
                    >
                      {isDeciding ? "Working..." : "Sign"}
                    </ActionButton>
                    <ActionButton variant="danger" className="px-3" disabled={isDeciding}
                      onClick={() => coSign(requestId, false)}
                    >
                      Decline to sign
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton variant="danger" className="px-3" disabled={isDeciding}
                    onClick={() => {
                      if (String(request.kind ?? "") === "document-letter" || request.kind === "id-card" || request.kind === "store-order") {
                        setRejectModalId(requestId);
                        setRejectionReason("");
                      } else {
                        decide(requestId, "rejected", false, String(request.kind ?? ""));
                      }
                    }}
                  >
                    {isDeciding ? "Working..." : "Decline"}
                  </ActionButton>
                )}
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
                ) : ["document-letter", "id-card"].includes(String(request.kind ?? "")) ? null : (
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
        {groupedApprovals.length === 0 ? (
          <EmptyState
            message={
              GROUPS.find((group) => group.id === effectiveGroup)?.empty ?? "No pending approvals."
            }
          />
        ) : null}
      </div>

      <Modal open={!!rejectModalId} onClose={() => setRejectModalId(null)} title="Rejection Reason"
        description="Provide a reason for declining this request." maxWidth="max-w-md"
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setRejectModalId(null)}>Cancel</ActionButton>
            <ActionButton variant="danger" disabled={!rejectionReason.trim()} onClick={() => {
              if (rejectModalId) {
                const rejectRequest = approvals.find((r) => requestIdOf(r) === rejectModalId);
                decide(rejectModalId, "rejected", false, String(rejectRequest?.kind ?? ""), rejectionReason.trim());
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
            phone:
              String((idCardPreviewRequest.requester as AnyRecord)?.phone ?? "") ||
              (idCardPreviewRequest.metadata as AnyRecord)?.userPhone,
            email:
              String((idCardPreviewRequest.requester as AnyRecord)?.email ?? "") ||
              (idCardPreviewRequest.metadata as AnyRecord)?.userEmail,
            avatarUrl:
              String((idCardPreviewRequest.requester as AnyRecord)?.avatarUrl ?? "") ||
              (idCardPreviewRequest.metadata as AnyRecord)?.userAvatar,
            bloodGroup:
              String((idCardPreviewRequest.requester as AnyRecord)?.bloodGroup ?? "") ||
              (idCardPreviewRequest.metadata as AnyRecord)?.userBloodGroup,
            emergencyContact:
              String((idCardPreviewRequest.requester as AnyRecord)?.emergencyContact ?? "") ||
              (idCardPreviewRequest.metadata as AnyRecord)?.userEmergencyContact,
            regionLabel:
              String((idCardPreviewRequest.requester as AnyRecord)?.regionLabel ?? "") ||
              (idCardPreviewRequest.metadata as AnyRecord)?.userRegionLabel,
            companyIdentityCode:
              String((idCardPreviewRequest.requester as AnyRecord)?.companyIdentityCode ?? "") ||
              (idCardPreviewRequest.metadata as AnyRecord)?.userIdentityCode,
            companyJoined:
              (idCardPreviewRequest.metadata as AnyRecord)?.userJoiningDate ||
              (idCardPreviewRequest.requester as AnyRecord)?.companyJoined ||
              (idCardPreviewRequest.requester as AnyRecord)?.createdAt,
            createdAt: (idCardPreviewRequest.requester as AnyRecord)?.createdAt,
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

      {letterPreview ? (
        <Modal
          open
          onClose={() => {
            setLetterPreview(null);
            // The framed page can sign or approve the letter itself, so refresh
            // to pick up whatever happened while it was open.
            void refresh();
          }}
          title="Letter preview"
          description="Read-only until you approve or sign below."
          maxWidth="max-w-5xl"
          footer={
            <>
              <a
                href={`/letter/${letterPreview.id}${letterPreview.draft ? "?draft=1" : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-[var(--c-bg-muted)]"
              >
                Open in new tab
              </a>
              <ActionButton variant="secondary" onClick={() => {
                setLetterPreview(null);
                void refresh();
              }}>
                Close
              </ActionButton>
            </>
          }
        >
          <iframe
            src={`/letter/${letterPreview.id}${letterPreview.draft ? "?draft=1" : ""}`}
            title="Letter preview"
            className="h-[68vh] w-full rounded-lg border border-slate-200"
          />
        </Modal>
      ) : null}
    </section>
  );
}
