"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Plus, Pencil, Eye, Trash2, Globe, Archive, Share2, Check, Cog } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { apiFetch } from "@/lib/client-utils";
import { CURRENCY_SYMBOLS, STAGES, STAGE_LABELS, type Stage, type Source, type JobStatus } from "@/lib/recruitment-types";

export default function JobDetailPage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isAdmin = role === "admin";
  const isHrOrAdmin = role === "admin" || role === "human-resource";
  const { activeJob, candidates, loading, fetchJob, fetchCandidates, setModal, updateJob } = useRecruitmentStore(
    useShallow((s) => ({ activeJob: s.activeJob, candidates: s.candidates, loading: s.loading, fetchJob: s.fetchJob, fetchCandidates: s.fetchCandidates, setModal: s.setModal, updateJob: s.updateJob }))
  );
  const [candidateFilter, setCandidateFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsWarn, setAtsWarn] = useState<{ open: boolean; missingDesc: boolean; missingSkills: boolean; missingThreshold: boolean; force: boolean }>({ open: false, missingDesc: false, missingSkills: false, missingThreshold: false, force: false });
  const [atsResultData, setAtsResultData] = useState<{ scored: number; selected: number; rejected: number; errors: number; total: number } | null>(null);
  const [atsLastResult, setAtsLastResult] = useState<{ scored: number; selected: number; rejected: number; errors: number; total: number } | null>(null);
  const [atsDecisionPending, setAtsDecisionPending] = useState(false);
  const [atsAction, setAtsAction] = useState<"continue" | "reject">("continue");

  async function handleRunAts(force: boolean) {
    if (!activeJob) return;
    const missingDesc = !activeJob.description?.trim();
    const missingSkills = !activeJob.requiredSkills?.length;
    const missingThreshold = activeJob.atsScoreThreshold == null;
    if (missingDesc || missingSkills || missingThreshold) {
      setAtsWarn({ open: true, missingDesc, missingSkills, missingThreshold, force });
      return;
    }
    await proceedScan(force);
  }

  async function proceedScan(force: boolean) {
    setAtsLoading(true);
    setAtsResultData(null);
    try {
      const result = await apiFetch<{ scored: number; selected: number; rejected: number; errors: number; total: number }>(`/api/recruitment/jobs/${id}/ats-score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
      setAtsResultData(result);
      setAtsLastResult(result);
      setAtsDecisionPending(true);
      setAtsAction("continue");
      void fetchCandidates({ jobId: id });
    } catch {
      setAtsResultData(null);
    } finally {
      setAtsLoading(false);
    }
  }

  useEffect(() => { void fetchJob(id); void fetchCandidates({ jobId: id }); }, [id, fetchJob, fetchCandidates]);

  const jobCandidates = useMemo(
    () => candidates.filter((c) => {
      const job = c.job as unknown as { _id?: string; id?: string } | string;
      const jobId = typeof job === "string" ? job : (job?._id || job?.id || "");
      return jobId === id;
    }),
    [candidates, id],
  );

  const filtered = useMemo(() => {
    let list = jobCandidates;
    if (candidateFilter === "__ats-selected") list = list.filter((c) => c.atsStatus === "selected");
    else if (candidateFilter === "__ats-rejected") list = list.filter((c) => c.atsStatus === "rejected");
    else if (candidateFilter === "__ats-pending") list = list.filter((c) => c.atsScore == null);
    else if (candidateFilter) list = list.filter((c) => c.stage === candidateFilter);
    return list;
  }, [jobCandidates, candidateFilter]);

  if (loading && !activeJob) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
      </div>
    );
  }

  if (!activeJob) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Job not found.</p>
        <button onClick={() => router.push("/recruitment/jobs")} className="mt-2 text-sm text-slate-600 underline" suppressHydrationWarning>Back to jobs</button>
      </div>
    );
  }

  const stages = STAGES;

  return (
    <div className="p-6">
      <button
        onClick={() => router.push("/recruitment/jobs")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to jobs
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{activeJob.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ activeJob.status === "open" ? "bg-emerald-50 text-emerald-700" : activeJob.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-[var(--c-bg-muted)] text-slate-600" }`}>{activeJob.status}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{activeJob.department} &middot; {activeJob.location || "Remote"} &middot; {activeJob.employmentType}{activeJob.durationMonths ? ` · ${activeJob.durationMonths} months` : ""}{activeJob.requiredExperienceYears ? ` · ${activeJob.requiredExperienceYears}+ years exp` : ""}</p>
          {activeJob.salaryRangeMin > 0 || activeJob.salaryRangeMax > 0 ? (
            <p className="text-sm text-slate-500">Salary: {CURRENCY_SYMBOLS[activeJob.currency] || "₹"}{activeJob.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[activeJob.currency] || "₹"}{activeJob.salaryRangeMax.toLocaleString()}{activeJob.salaryType === "per-month" ? " per month" : " per annum"}</p>
          ) : null}
          <p className="text-sm text-slate-500">{activeJob.openings} opening{activeJob.openings > 1 ? "s" : ""} &middot; {jobCandidates.length} candidate{jobCandidates.length !== 1 ? "s" : ""}</p>
          {activeJob.autoCloseDate && (
            <p className="text-sm text-slate-500">Auto-closes: {new Date(activeJob.autoCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
          )}
        </div>
        <div className="flex gap-2">
          {activeJob.status === "open" && (
            <button
              onClick={() => {
                const c = typeof activeJob.company === "object" ? (activeJob.company as any)?.name || "" : "";
                const slug = c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                const url = slug ? `${window.location.origin}/careers/jobs/${slug}/${id}` : "";
                if (url) navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              {copied ? <Check size={15} /> : <Share2 size={15} />} {copied ? "Copied" : "Share"}
            </button>
          )}
          {activeJob.status === "draft" && isAdmin && (
            <button
              onClick={() => { void updateJob(id, { status: "open" as JobStatus }); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
            >
              <Globe size={15} /> Publish
            </button>
          )}
          {activeJob.status === "open" && isAdmin && (
            <button
              onClick={() => { void updateJob(id, { status: "closed" as JobStatus }); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <Archive size={15} /> Close
            </button>
          )}
          <button
            onClick={() => router.push(`/recruitment/jobs/${id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
          >
            <Pencil size={15} /> Edit
          </button>
          <button
            onClick={() => router.push(`/recruitment/jobs/${id}/board`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
          >
            <Eye size={15} /> Kanban
          </button>
          <button
            onClick={() => setModal({ type: "create-candidate", jobId: id })}
            className="neu-btn neu-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <Plus size={15} /> Add Candidate
          </button>
          {isHrOrAdmin && (
            <button
              onClick={() => void handleRunAts(false)}
              disabled={atsLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
            >
              <Cog size={15} className={atsLoading ? "animate-spin" : ""} />
              {atsLoading ? "Scoring..." : "Run ATS Score"}
            </button>
          )}
          {isHrOrAdmin && (
            <button
              onClick={() => void handleRunAts(true)}
              disabled={atsLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50"
            >
              {atsLoading ? "Scoring..." : "Re-score All"}
            </button>
          )}
          {atsDecisionPending && atsLastResult && (
            <button
              onClick={() => setAtsResultData(atsLastResult)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Review ATS rejections
            </button>
          )}
          {activeJob.atsScoreThreshold != null && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
              ATS Threshold: {activeJob.atsScoreThreshold}+
            </span>
          )}
          {activeJob.status !== "open" && (
            <button
              onClick={() => setModal({ type: "delete-job", jobId: id })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </div>

      {activeJob.description && (
        <div className="mt-4 rounded-lg neu-card p-4">
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{activeJob.description}</p>
        </div>
      )}

      {activeJob.requiredSkills?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeJob.requiredSkills.map((skill) => (
            <span key={skill} className="rounded-full bg-[var(--c-bg-muted)] px-3 py-1 text-xs font-medium text-slate-700">{skill}</span>
          ))}
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Candidates ({jobCandidates.length})</h2>
          <select
            className="neu-inset rounded-lg px-3 py-1.5 text-sm"
            value={candidateFilter}
            onChange={(e) => setCandidateFilter(e.target.value)}
          >
            <option value="">All Stages</option>
            <optgroup label="By Stage">
              {stages.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s as Stage]}</option>
              ))}
            </optgroup>
            <optgroup label="By ATS Status">
              <option value="__ats-selected">ATS Selected</option>
              <option value="__ats-rejected">ATS Rejected</option>
              <option value="__ats-pending">Not Scored</option>
            </optgroup>
          </select>
        </div>
        {atsResultData && (
          <div className="mt-2 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">
            Scored {atsResultData.scored} candidate{atsResultData.scored !== 1 ? "s" : ""} — {atsResultData.selected} selected, {atsResultData.rejected} rejected{atsResultData.errors > 0 ? `, ${atsResultData.errors} error${atsResultData.errors !== 1 ? "s" : ""}` : ""}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {filtered.map((candidate) => (
            <div
              key={candidate.id}
              className="flex items-center justify-between rounded-lg neu-card p-4 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{candidate.firstName} {candidate.lastName}</span>
                  {candidate.atsScore != null && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ candidate.atsStatus === "selected" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700" }`}>
                      ATS {candidate.atsScore}
                    </span>
                  )}
                  {candidate.atsStatus === "rejected" && candidate.stage !== "ats-rejected" && candidate.stage !== "rejected" && (
                    <span className="text-[10px] font-medium text-amber-600">ATS-flagged, HR reviewing</span>
                  )}
                  {candidate.rating > 0 && (
                    <span className="text-xs text-amber-500">{'★'.repeat(candidate.rating)}{'☆'.repeat(5 - candidate.rating)}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{candidate.email}</span>
                  {candidate.currentCompany && <><span>&middot;</span><span>{candidate.currentCompany}</span></>}
                  {candidate.experienceYears > 0 && <><span>&middot;</span><span>{candidate.experienceYears}y exp</span></>}
                </div>
                {candidate.atsRejectionNote && (
                  <p className="mt-1 line-clamp-2 text-xs text-rose-600">
                    <span className="font-medium">Rejected:</span> {candidate.atsRejectionNote}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ candidate.stage === "joined" ? "bg-emerald-50 text-emerald-700" : candidate.stage === "rejected" || candidate.stage === "ats-rejected" ? "bg-rose-50 text-rose-700" : candidate.stage === "offer" ? "bg-indigo-50 text-indigo-700" : "bg-[var(--c-bg-muted)] text-slate-600" }`}>
                  {STAGE_LABELS[candidate.stage]}
                </span>
                <button
                  onClick={() => router.push(`/recruitment/candidates/${candidate.id}`)}
                  className="rounded-lg border border-[var(--c-border-light)] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
                >
                  Profile
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No candidates found.</p>
          )}
        </div>
      </div>

      <DeleteJobModal id={id} />
      <CandidateModal jobId={id} />
      <AtsWarnModal
        warn={atsWarn}
        onCancel={() => setAtsWarn((w) => ({ ...w, open: false }))}
        onContinue={() => {
          const force = atsWarn.force;
          setAtsWarn((w) => ({ ...w, open: false }));
          void proceedScan(force);
        }}
      />
      <AtsResultModal
        result={atsResultData}
        action={atsAction}
        onActionChange={setAtsAction}
        onMarkLater={() => setAtsResultData(null)}
        onSubmit={async (action, note) => {
          if (action === "reject") {
            try {
              await apiFetch(`/api/recruitment/jobs/${id}/ats-apply-rejections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
              void fetchCandidates({ jobId: id });
            } catch {}
          }
          setAtsDecisionPending(false);
          setAtsResultData(null);
        }}
      />
    </div>
  );
}

function AtsWarnModal({
  warn,
  onCancel,
  onContinue,
}: {
  warn: { open: boolean; missingDesc: boolean; missingSkills: boolean; missingThreshold: boolean; force: boolean };
  onCancel: () => void;
  onContinue: () => void;
}) {
  if (!warn.open) return null;
  const { missingDesc, missingSkills, missingThreshold } = warn;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">Before you scan</h2>
          <p className="mt-2 text-sm text-slate-600">
            This job is missing details that help score resumes accurately:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {missingDesc && <li>Job description is not provided.</li>}
            {missingSkills && <li>Required skills are not provided.</li>}
            {missingThreshold && <li>ATS score threshold is not set (scanning is not possible without it).</li>}
          </ul>
          {(missingDesc || missingSkills) && (
            <p className="mt-3 text-sm text-slate-600">
              Candidate scores may differ because the description or required skills are not mentioned. Do you want to continue?
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              disabled={missingThreshold}
              className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {missingThreshold ? "Set threshold first" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AtsResultModal({
  result,
  action,
  onActionChange,
  onMarkLater,
  onSubmit,
}: {
  result: { scored: number; selected: number; rejected: number; errors: number; total: number } | null;
  action: "continue" | "reject";
  onActionChange: (value: "continue" | "reject") => void;
  onMarkLater: () => void;
  onSubmit: (action: "continue" | "reject", note: string) => void;
}) {
  const [note, setNote] = useState("");
  if (!result) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">What do you want to do with ATS-rejected candidates?</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[var(--c-bg-muted)] p-3">
              <p className="text-lg font-semibold text-slate-900">{result.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-lg font-semibold text-emerald-700">{result.selected}</p>
              <p className="text-xs text-slate-500">Approved</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3">
              <p className="text-lg font-semibold text-rose-700">{result.rejected}</p>
              <p className="text-xs text-slate-500">Rejected</p>
            </div>
          </div>
          {result.errors > 0 && (
            <p className="mt-2 text-xs text-amber-600">{result.errors} candidate(s) could not be scored due to errors.</p>
          )}
          <label className="mt-4 block text-sm font-medium text-slate-700">Action for rejected candidates</label>
          <select
            value={action}
            onChange={(e) => onActionChange(e.target.value as "continue" | "reject")}
            className="neu-inset mt-1 w-full rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="continue">Continue (manual review — leave stages as-is)</option>
            <option value="reject">Reject them (move to ATS Rejected stage)</option>
          </select>
          {action === "reject" && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-slate-700">Rejection note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Type a reason for rejection. If left empty, an automatic ATS-based reason will be recorded."
                className="neu-inset mt-1 w-full resize-none rounded-lg px-3 py-2.5 text-sm"
              />
              <p className="mt-1 text-xs text-slate-400">
                {note.trim() ? "A manual note will be saved." : "An auto note (score vs. threshold + ATS reason) will be saved."}
              </p>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              onClick={onMarkLater}
              className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
            >
              Mark them later
            </button>
            <button
              onClick={() => onSubmit(action, note.trim())}
              className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-sm font-medium"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteJobModal({ id }: { id: string }) {
  const router = useRouter();
  const { modal, setModal, deleteJob, activeJob } = useRecruitmentStore();
  if (modal?.type !== "delete-job") return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-sm rounded-lg neu-card">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">Delete Job</h2>
          <p className="mt-2 text-sm text-slate-600">
            Delete "{activeJob?.title}"? This will permanently delete the job and all associated candidates, interviews, offers, and uploaded resumes.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={async () => { await deleteJob(id); setModal(null); router.push("/recruitment/jobs"); }}
              className="neu-btn neu-btn-danger rounded-lg px-4 py-2 text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateModal({ jobId }: { jobId: string }) {
  const { modal, setModal, createCandidate } = useRecruitmentStore();
  if (modal?.type !== "create-candidate") return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      currentCompany: String(form.get("currentCompany") || ""),
      experienceYears: Number(form.get("experienceYears") || 0),
      currentCTC: Number(form.get("currentCTC") || 0),
      expectedCTC: Number(form.get("expectedCTC") || 0),
      noticePeriod: Number(form.get("noticePeriod") || 0),
      source: String(form.get("source") || "Other") as Source,
      job: jobId,
    };
    await createCandidate(data);
    setModal(null);
  }

  const sources = ["Referral", "LinkedIn", "Company Website", "Naukri", "Indeed", "Walk-In", "Other"];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-lg rounded-lg neu-card">
        <div className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
          <h2 className="text-base font-semibold">Add Candidate</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form className="space-y-4 p-5 max-h-[80vh] overflow-y-auto" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">First Name *</span>
              <input name="firstName" required className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Last Name</span>
              <input name="lastName" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email *</span>
              <input name="email" type="email" required className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
              <input name="phone" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Current Company</span>
              <input name="currentCompany" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Experience (years)</span>
              <input name="experienceYears" type="number" min="0" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Current CTC</span>
              <input name="currentCTC" type="number" min="0" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Expected CTC</span>
              <input name="expectedCTC" type="number" min="0" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Notice Period (days)</span>
              <input name="noticePeriod" type="number" min="0" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Source</span>
              <select name="source" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm">
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className="neu-btn neu-btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium">
            Add Candidate
          </button>
        </form>
      </div>
    </div>
  );
}
