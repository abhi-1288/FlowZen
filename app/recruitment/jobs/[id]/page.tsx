"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Plus, Pencil, Eye, Trash2, Globe, Archive, Share2, Check } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { CURRENCY_SYMBOLS, STAGE_LABELS, type Stage, type Source, type JobStatus } from "@/lib/recruitment-types";

export default function JobDetailPage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isAdmin = role === "admin";
  const { activeJob, candidates, loading, fetchJob, fetchCandidates, setModal, updateJob } = useRecruitmentStore(
    useShallow((s) => ({ activeJob: s.activeJob, candidates: s.candidates, loading: s.loading, fetchJob: s.fetchJob, fetchCandidates: s.fetchCandidates, setModal: s.setModal, updateJob: s.updateJob }))
  );
  const [candidateFilter, setCandidateFilter] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { void fetchJob(id); void fetchCandidates({ jobId: id }); }, [id, fetchJob, fetchCandidates]);

  const filtered = useMemo(() => candidateFilter
    ? candidates.filter((c) => c.stage === candidateFilter)
    : candidates,
  [candidates, candidateFilter]);

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
        <button onClick={() => router.push("/recruitment/jobs")} className="mt-2 text-sm text-slate-600 underline">Back to jobs</button>
      </div>
    );
  }

  const stages = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];

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
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              activeJob.status === "open" ? "bg-emerald-50 text-emerald-700" :
              activeJob.status === "draft" ? "bg-amber-50 text-amber-700" :
              "bg-slate-100 text-slate-600"
            }`}>{activeJob.status}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{activeJob.department} &middot; {activeJob.location || "Remote"} &middot; {activeJob.employmentType}</p>
          {activeJob.salaryRangeMin > 0 || activeJob.salaryRangeMax > 0 ? (
            <p className="text-sm text-slate-500">Salary: {CURRENCY_SYMBOLS[activeJob.currency] || "₹"}{activeJob.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[activeJob.currency] || "₹"}{activeJob.salaryRangeMax.toLocaleString()}{activeJob.salaryType === "per-month" ? " per month" : " per annum"}</p>
          ) : null}
          <p className="text-sm text-slate-500">{activeJob.openings} opening{activeJob.openings > 1 ? "s" : ""} &middot; {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</p>
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <Archive size={15} /> Close
            </button>
          )}
          <button
            onClick={() => router.push(`/recruitment/jobs/${id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Pencil size={15} /> Edit
          </button>
          <button
            onClick={() => router.push(`/recruitment/jobs/${id}/board`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Eye size={15} /> Kanban
          </button>
          <button
            onClick={() => setModal({ type: "create-candidate", jobId: id })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus size={15} /> Add Candidate
          </button>
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
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{activeJob.description}</p>
        </div>
      )}

      {activeJob.requiredSkills?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeJob.requiredSkills.map((skill) => (
            <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{skill}</span>
          ))}
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Candidates ({candidates.length})</h2>
          <select
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none"
            value={candidateFilter}
            onChange={(e) => setCandidateFilter(e.target.value)}
          >
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s as Stage]}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-3">
          {filtered.map((candidate) => (
            <div
              key={candidate.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{candidate.firstName} {candidate.lastName}</span>
                  {candidate.rating > 0 && (
                    <span className="text-xs text-amber-500">{'★'.repeat(candidate.rating)}{'☆'.repeat(5 - candidate.rating)}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{candidate.email}</span>
                  {candidate.currentCompany && <><span>&middot;</span><span>{candidate.currentCompany}</span></>}
                  {candidate.experienceYears > 0 && <><span>&middot;</span><span>{candidate.experienceYears}y exp</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  candidate.stage === "joined" ? "bg-emerald-50 text-emerald-700" :
                  candidate.stage === "rejected" ? "bg-rose-50 text-rose-700" :
                  candidate.stage === "offer" ? "bg-indigo-50 text-indigo-700" :
                  "bg-slate-100 text-slate-600"
                }`}>
                  {STAGE_LABELS[candidate.stage]}
                </span>
                <button
                  onClick={() => router.push(`/recruitment/candidates/${candidate.id}`)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
    </div>
  );
}

function DeleteJobModal({ id }: { id: string }) {
  const router = useRouter();
  const { modal, setModal, deleteJob, activeJob } = useRecruitmentStore();
  if (modal?.type !== "delete-job") return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-soft">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">Delete Job</h2>
          <p className="mt-2 text-sm text-slate-600">
            Delete "{activeJob?.title}"? This will permanently delete the job and all associated candidates, interviews, offers, and uploaded resumes.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => { await deleteJob(id); setModal(null); router.push("/recruitment/jobs"); }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Add Candidate</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form className="space-y-4 p-5 max-h-[80vh] overflow-y-auto" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">First Name *</span>
              <input name="firstName" required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Last Name</span>
              <input name="lastName" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email *</span>
              <input name="email" type="email" required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
              <input name="phone" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Current Company</span>
              <input name="currentCompany" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Experience (years)</span>
              <input name="experienceYears" type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Current CTC</span>
              <input name="currentCTC" type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Expected CTC</span>
              <input name="expectedCTC" type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Notice Period (days)</span>
              <input name="noticePeriod" type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Source</span>
              <select name="source" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className="w-full rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            Add Candidate
          </button>
        </form>
      </div>
    </div>
  );
}
