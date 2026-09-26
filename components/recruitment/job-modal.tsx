"use client";

import { useEffect, useState } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import type { EmploymentType, JobStatus, SalaryType } from "@/lib/recruitment-types";
import { apiFetch } from "@/lib/client-utils";
import { dateInputValue, timeInputValue, utcWallClock } from "@/lib/date-utils";
import { MarkdownTextarea } from "@/components/recruitment/markdown-textarea";

/**
 * The one create/edit form for a job, shared by the jobs list tab and the job
 * detail page. Both open it through the store's `modal` state
 * (`{ type: "create-job" }` / `{ type: "edit-job", jobId }`).
 */
export function JobModal() {
  const { modal, setModal, createJob, updateJob, jobs, activeJob, saving, error } = useRecruitmentStore(
    useShallow((s) => ({
      modal: s.modal,
      setModal: s.setModal,
      createJob: s.createJob,
      updateJob: s.updateJob,
      jobs: s.jobs,
      activeJob: s.activeJob,
      saving: s.saving,
      error: s.error,
    }))
  );

  const isEdit = modal?.type === "edit-job";
  // The list array is paginated and filtered, so a job opened from the detail
  // page may not be in it. `activeJob` covers that case.
  const editingJob =
    modal?.type === "edit-job"
      ? jobs.find((j) => j.id === modal.jobId) ?? (activeJob?.id === modal.jobId ? activeJob : null)
      : null;

  const [regions, setRegions] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [useOther, setUseOther] = useState(false);
  const [durationUnit, setDurationUnit] = useState("months");
  const [durationValue, setDurationValue] = useState("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setLocation(editingJob?.location || "");
    setDescription(editingJob?.description || "");
    setUseOther(false);
    setSubmitError("");
    setAttempted(false);
    if (editingJob?.durationYears) {
      setDurationUnit("years");
      setDurationValue(String(editingJob.durationYears));
    } else if (editingJob?.durationMonths) {
      setDurationUnit("months");
      setDurationValue(String(editingJob.durationMonths));
    } else if (editingJob?.durationDays) {
      setDurationUnit("days");
      setDurationValue(String(editingJob.durationDays));
    } else if (editingJob?.durationHours) {
      setDurationUnit("hours");
      setDurationValue(String(editingJob.durationHours));
    } else {
      setDurationUnit("months");
      setDurationValue("");
    }
    let active = true;
    apiFetch<{ addresses: { label?: string }[]; multiOffice: boolean }>("/api/company/address")
      .then((res) => {
        if (!active) return;
        setRegions(
          (res.addresses || [])
            .map((a) => (a.label ?? "").trim())
            .filter(Boolean)
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [modal?.type, editingJob?.id]);

  if (!modal) return null;
  if (modal.type !== "create-job" && modal.type !== "edit-job") return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSubmitError("");
    setAttempted(true);
    if (isEdit && !editingJob) {
      setSubmitError("That job could not be loaded. Close this and try again.");
      return;
    }
    const form = new FormData(e.currentTarget);
    const unit = String(form.get("durationUnit") || "months");
    const value = form.get("durationValue") ? Number(form.get("durationValue")) : null;
    const data: Record<string, unknown> = {
      title: String(form.get("title") || ""),
      department: String(form.get("department") || ""),
      location: String(form.get("location") || ""),
      employmentType: String(form.get("employmentType") || "full-time") as EmploymentType,
      durationMonths: unit === "months" ? value : null,
      durationDays: unit === "days" ? value : null,
      durationHours: unit === "hours" ? value : null,
      durationYears: unit === "years" ? value : null,
      requiredExperienceYears: form.get("requiredExperienceYears") ? Number(form.get("requiredExperienceYears")) : null,
      requiredExperienceMaxYears: form.get("requiredExperienceMaxYears") ? Number(form.get("requiredExperienceMaxYears")) : null,
      atsScoreThreshold: form.get("atsScoreThreshold") ? Number(form.get("atsScoreThreshold")) : null,
      currency: String(form.get("currency") || "INR"),
      salaryRangeMin: Number(form.get("salaryRangeMin") || 0),
      salaryRangeMax: Number(form.get("salaryRangeMax") || 0),
      salaryType: String(form.get("salaryType") || "per-annum") as SalaryType,
      openings: Number(form.get("openings") || 1),
      autoCloseDate: utcWallClock(
        String(form.get("autoCloseDate") || ""),
        String(form.get("autoCloseTime") || ""),
        "23:59:59"
      ),
      description,
      requiredSkills: String(form.get("requiredSkills") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      assessment: Boolean(form.get("assessment")),
      assessmentDate: form.get("assessment")
        ? utcWallClock(
            String(form.get("assessmentDate") || ""),
            String(form.get("assessmentTime") || ""),
            "00:00:00"
          )
        : null,
    };

    try {
      if (isEdit && editingJob) {
        // `status` is deliberately omitted on edit: sending a fixed value here
        // used to knock published jobs back to draft on every save.
        await updateJob(editingJob.id, data);
      } else {
        // createJob swallows its own errors and resolves undefined on failure,
        // so an absent job here means the POST did not go through.
        const job = await createJob({ ...data, status: "draft" as JobStatus });
        if (!job) {
          setSubmitError("The job could not be created. Please try again.");
          return;
        }
        window.location.href = `/recruitment/jobs/${job.id}`;
      }
    } catch {
      return;
    }
    setModal(null);
  }

  const failure = submitError || (attempted && isEdit ? error : "");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-soft dark:bg-[#000000]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold">{isEdit ? "Edit Job" : "New Job"}</h2>
          <button suppressHydrationWarning className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form
          key={isEdit ? editingJob?.id ?? "unresolved" : "new"}
          className="space-y-4 p-5 max-h-[80vh] overflow-y-auto overflow-x-hidden"
          onSubmit={handleSubmit}
        >
          {failure && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {failure}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Title *</span>
              <input name="title" defaultValue={editingJob?.title || ""} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Department *</span>
              <input name="department" defaultValue={editingJob?.department || ""} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Location</span>
              {useOther ? (
                <div className="flex gap-2">
                  <input
                    name="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={() => setUseOther(false)}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    List
                  </button>
                </div>
              ) : (
                <select
                  name="location"
                  value={location}
                  onChange={(e) => {
                    if (e.target.value === "__other__") {
                      setUseOther(true);
                      setLocation("");
                    } else {
                      setLocation(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
                >
                  {location && !regions.includes(location) && location !== "Remote" && location !== "PAN" && (
                    <option value={location}>{location}</option>
                  )}
                  {regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="Remote">Remote</option>
                  <option value="PAN">PAN</option>
                  <option value="__other__">Other…</option>
                </select>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Employment Type</span>
              <select suppressHydrationWarning name="employmentType" defaultValue={editingJob?.employmentType || "full-time"} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800">
                <option value="full-time">Full Time</option>
                <option value="part-time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Duration</span>
              <div className="flex gap-2">
                <select suppressHydrationWarning name="durationUnit" value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} className="w-28 shrink-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800">
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
                <input name="durationValue" type="number" min="0" value={durationValue} onChange={(e) => setDurationValue(e.target.value)} placeholder="e.g. 6" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Required Experience (years)</span>
              <div className="flex items-center gap-2">
                <input name="requiredExperienceYears" type="number" min="0" max="50" defaultValue={editingJob?.requiredExperienceYears || ""} placeholder="Min, e.g. 1" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800" />
                <span className="text-sm text-slate-400">to</span>
                <input name="requiredExperienceMaxYears" type="number" min="0" max="50" defaultValue={editingJob?.requiredExperienceMaxYears || ""} placeholder="Max, e.g. 2" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800" />
              </div>
              <span className="mt-1 block text-xs text-slate-400 dark:text-zinc-500">Leave Max empty for &ldquo;{">"}= Min years&rdquo;.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">ATS Min Score (0-100)</span>
              <input name="atsScoreThreshold" type="number" min="0" max="100" defaultValue={editingJob?.atsScoreThreshold || ""} placeholder="e.g. 70" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Min Salary</span>
              <input name="salaryRangeMin" type="number" defaultValue={editingJob?.salaryRangeMin || 0} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Max Salary</span>
              <input name="salaryRangeMax" type="number" defaultValue={editingJob?.salaryRangeMax || 0} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Currency</span>
              <select suppressHydrationWarning name="currency" defaultValue={editingJob?.currency || "INR"} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800">
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
                <option value="GBP">£ GBP</option>
                <option value="JPY">¥ JPY</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Salary Type</span>
              <select suppressHydrationWarning name="salaryType" defaultValue={editingJob?.salaryType || "per-annum"} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800">
                <option value="per-annum">Per Annum</option>
                <option value="per-month">Per Month</option>
                <option value="per-day">Per Day</option>
                <option value="per-hour">Per Hour</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Openings</span>
              <input name="openings" type="number" min="1" defaultValue={editingJob?.openings || 1} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none dark:border-zinc-800" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Auto-Close Date & Time</span>
              <div className="flex gap-2">
                <input name="autoCloseDate" type="date" defaultValue={editingJob?.autoCloseDate ? dateInputValue(editingJob.autoCloseDate) : ""} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
                <input name="autoCloseTime" type="time" defaultValue={editingJob?.autoCloseDate ? timeInputValue(editingJob.autoCloseDate) : ""} className="w-28 shrink-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
              </div>
            </label>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="assessment"
                  defaultChecked={editingJob?.assessment || false}
                  onChange={(e) => {
                    const el = document.getElementById("assessment-fields");
                    if (el) el.style.display = e.currentTarget.checked ? "block" : "none";
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">Enable Online Assessment (after Screening)</span>
              </label>
              <div id="assessment-fields" className="mt-2" style={{ display: editingJob?.assessment ? "block" : "none" }}>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Assessment Date & Time</span>
                  <div className="flex gap-2">
                    <input name="assessmentDate" type="date" defaultValue={editingJob?.assessmentDate ? dateInputValue(editingJob.assessmentDate) : ""} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
                    <input name="assessmentTime" type="time" defaultValue={editingJob?.assessmentDate ? timeInputValue(editingJob.assessmentDate) : ""} className="w-28 shrink-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
                  </div>
                </label>
              </div>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Required Skills (comma separated)</span>
            <input name="requiredSkills" defaultValue={editingJob?.requiredSkills?.join(", ") || ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Description</span>
            <MarkdownTextarea name="description" value={description} onChange={setDescription} rows={5} />
          </div>
          <button suppressHydrationWarning type="submit" disabled={saving} className="w-full rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Job"}
          </button>
        </form>
      </div>
    </div>
  );
}
