"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Search, Eye, Pencil, Archive, Globe, Share2, Check } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import type { EmploymentType, JobStatus } from "@/lib/recruitment-types";

export default function JobsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isAdmin = role === "admin";
  const { jobs, loading, fetchJobs, updateJob, setModal } = useRecruitmentStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

  useEffect(() => { if (jobs.length === 0) void fetchJobs(); }, [jobs.length, fetchJobs]);

  const filtered = jobs.filter((j) => {
    if (statusFilter && j.status !== statusFilter) return false;
    if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Job Openings</h1>
          <p className="mt-1 text-sm text-slate-500">{jobs.length} total jobs</p>
        </div>
        <button
          onClick={() => setModal({ type: "create-job" })}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus size={16} />
          New Job
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-950"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-slate-500">No jobs found.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-slate-900">{job.title}</h3>
                  <p className="text-sm text-slate-500">{job.department}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  job.status === "open" ? "bg-emerald-50 text-emerald-700" :
                  job.status === "draft" ? "bg-amber-50 text-amber-700" :
                  "bg-slate-100 text-slate-600"
                }`}>
                  {job.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{job.location || "Remote"}</span>
                <span>&middot;</span>
                <span>{job.employmentType}</span>
                {(job as any).applicantsCount !== undefined && (
                  <>
                    <span>&middot;</span>
                    <span>{(job as any).applicantsCount} applicants</span>
                  </>
                )}
                {job.autoCloseDate && (
                  <>
                    <span>&middot;</span>
                    <span>Closes: {new Date(job.autoCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => router.push(`/recruitment/jobs/${job.id}`)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Eye size={14} /> View
                </button>
                <button
                  onClick={() => { setModal({ type: "edit-job", jobId: job.id }); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Pencil size={14} /> Edit
                </button>
                {job.status === "open" && (
                  <button
                    onClick={() => {
                      const c = typeof job.company === "object" ? (job.company as any)?.name || "" : "";
                      const slug = c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                      const url = slug ? `${window.location.origin}/careers/jobs/${slug}/${job.id}` : "";
                      if (url) navigator.clipboard.writeText(url).then(() => { setCopiedJobId(job.id); setTimeout(() => setCopiedJobId(null), 2000); });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    {copiedJobId === job.id ? <Check size={14} /> : <Share2 size={14} />} {copiedJobId === job.id ? "Copied" : "Share"}
                  </button>
                )}
                {job.status === "draft" && isAdmin && (
                  <button
                    onClick={() => { void updateJob(job.id, { status: "open" as JobStatus }); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
                  >
                    <Globe size={14} /> Publish
                  </button>
                )}
                {job.status === "open" && isAdmin && (
                  <button
                    onClick={() => { void updateJob(job.id, { status: "closed" as JobStatus }); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Archive size={14} /> Close
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <JobModals />
    </div>
  );
}

function JobModals() {
  const { modal, setModal, createJob, updateJob, jobs } = useRecruitmentStore();
  const editingJob = modal?.type === "edit-job" ? jobs.find((j) => j.id === modal.jobId) : null;

  if (!modal || (modal.type !== "create-job" && modal.type !== "edit-job")) return null;

  const isEdit = modal.type === "edit-job";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      title: String(form.get("title") || ""),
      department: String(form.get("department") || ""),
      location: String(form.get("location") || ""),
      employmentType: String(form.get("employmentType") || "full-time") as EmploymentType,
      currency: String(form.get("currency") || "INR"),
      salaryRangeMin: Number(form.get("salaryRangeMin") || 0),
      salaryRangeMax: Number(form.get("salaryRangeMax") || 0),
      openings: Number(form.get("openings") || 1),
      autoCloseDate: String(form.get("autoCloseDate") || ""),
      description: String(form.get("description") || ""),
      requiredSkills: String(form.get("requiredSkills") || "").split(",").map((s) => s.trim()).filter(Boolean),
      status: "draft" as JobStatus,
    };
    if (isEdit && editingJob) {
      await updateJob(editingJob.id, data);
    } else {
      const job = await createJob(data);
      if (job) window.location.href = `/recruitment/jobs/${job.id}`;
    }
    setModal(null);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">{isEdit ? "Edit Job" : "New Job"}</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form className="space-y-4 p-5 max-h-[80vh] overflow-y-auto" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Title *</span>
              <input name="title" defaultValue={editingJob?.title || ""} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Department *</span>
              <input name="department" defaultValue={editingJob?.department || ""} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Location</span>
              <input name="location" defaultValue={editingJob?.location || ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Employment Type</span>
              <select name="employmentType" defaultValue={editingJob?.employmentType || "full-time"} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
                <option value="full-time">Full Time</option>
                <option value="part-time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Min Salary</span>
              <input name="salaryRangeMin" type="number" defaultValue={editingJob?.salaryRangeMin || 0} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Max Salary</span>
              <input name="salaryRangeMax" type="number" defaultValue={editingJob?.salaryRangeMax || 0} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Currency</span>
              <select name="currency" defaultValue={editingJob?.currency || "INR"} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
                <option value="GBP">£ GBP</option>
                <option value="JPY">¥ JPY</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Openings</span>
              <input name="openings" type="number" min="1" defaultValue={editingJob?.openings || 1} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Auto-Close Date</span>
              <input name="autoCloseDate" type="date" defaultValue={editingJob?.autoCloseDate ? editingJob.autoCloseDate.split("T")[0] : ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Required Skills (comma separated)</span>
            <input name="requiredSkills" defaultValue={editingJob?.requiredSkills?.join(", ") || ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
            <textarea name="description" defaultValue={editingJob?.description || ""} rows={4} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <button type="submit" className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            {isEdit ? "Save Changes" : "Create Job"}
          </button>
        </form>
      </div>
    </div>
  );
}
