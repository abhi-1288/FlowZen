"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Pencil, PencilOff, Trash2, Globe, Archive, Share2, Check, Cog, Briefcase, Building2, MapPin, Clock, Users, Banknote, ShieldCheck, CalendarClock, UserPlus, CalendarPlus, Columns3, ChevronDown, Download, ExternalLink, Upload, Loader2, CheckCircle } from "lucide-react";
import { DEFAULT_ACCENT, salarySuffix, hexToRgba } from "@/lib/accent";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import { apiFetch } from "@/lib/client-utils";
import { CURRENCY_SYMBOLS, STAGES, STAGE_LABELS, TERMINAL_STAGES, type Stage, type JobStatus, type ATSCandidate } from "@/lib/recruitment-types";
import { formatJobDuration } from "@/lib/format-duration";
import { JobDescription } from "@/components/recruitment/job-description";
import { InterviewLocationFields } from "@/components/recruitment/interview-location-fields";
import { AssessmentManagerModal } from "@/components/recruitment/assessment-manager";
import { AssessmentResultsModal } from "@/components/recruitment/assessment-results-modal";
import { AssessmentCandidatesModal } from "@/components/recruitment/assessment-candidates-modal";
import { assessmentResultsUnlocked } from "@/lib/assessment";

function fmtDateTime(value: string): string {
  return `${new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ${new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
}

function formatEmploymentType(type: string): string {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// The assessment candidates list is relevant from the day before the assessment
// onward (remains visible after the test day so HR can review who started/
// submitted).
function assessmentCandidatesVisible(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const assess = new Date(dateStr);
  if (isNaN(assess.getTime())) return false;
  const dayBefore = new Date(assess.getFullYear(), assess.getMonth(), assess.getDate() - 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today.getTime() >= dayBefore.getTime();
}

const INTERVIEWER_ROLES: Record<string, string> = {
  "project-manager": "Project Manager",
  "qa-tester": "QA Tester",
  finance: "Finance",
  "human-resource": "HR",
  admin: "Admin",
  "it-admin": "IT Admin",
  "it-administration": "IT Administrative",
};

function initials(first?: string, last?: string): string {
  const f = (first || "").trim().charAt(0);
  const l = (last || "").trim().charAt(0);
  return (f + l).toUpperCase() || "?";
}

function stagePillClass(stage: string): string {
  if (stage === "joined") return "bg-emerald-50 text-emerald-700";
  if (stage === "rejected" || stage === "ats-rejected") return "bg-rose-50 text-rose-700";
  if (stage === "offer") return "bg-indigo-50 text-indigo-700";
  return "bg-[var(--c-bg-muted)] text-slate-600";
}

export default function JobDetailPage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const isAdmin = role === "admin";
  const isHrOrAdmin = role === "admin" || role === "human-resource";
  const { activeJob, candidates, loading, fetchJob, fetchCandidates, setModal, updateJob, moveCandidateStage, setAtsDecision } = useRecruitmentStore(
    useShallow((s) => ({ activeJob: s.activeJob, candidates: s.candidates, loading: s.loading, fetchJob: s.fetchJob, fetchCandidates: s.fetchCandidates, setModal: s.setModal, updateJob: s.updateJob, moveCandidateStage: s.moveCandidateStage, setAtsDecision: s.setAtsDecision }))
  );
  const [candidateFilter, setCandidateFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsWarn, setAtsWarn] = useState<{ open: boolean; missingDesc: boolean; missingSkills: boolean; missingThreshold: boolean; force: boolean }>({ open: false, missingDesc: false, missingSkills: false, missingThreshold: false, force: false });
  const [atsResultData, setAtsResultData] = useState<{ scored: number; selected: number; rejected: number; errors: number; total: number } | null>(null);
  const [atsLastResult, setAtsLastResult] = useState<{ scored: number; selected: number; rejected: number; errors: number; total: number } | null>(null);
  const [atsDecisionPending, setAtsDecisionPending] = useState(false);
  const [atsAction, setAtsAction] = useState<"auto" | "manual">("auto");
  const [atsApplied, setAtsApplied] = useState<{ moved: number; advanced: number } | null>(null);
  const [bulkIvOpen, setBulkIvOpen] = useState(false);
  const [assessmentManagerOpen, setAssessmentManagerOpen] = useState(false);
  const [assessmentResultsOpen, setAssessmentResultsOpen] = useState(false);
  const [assessmentCandidatesOpen, setAssessmentCandidatesOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [assessmentStats, setAssessmentStats] = useState<{
    total: number;
    passed: number;
    failed: number;
    essayReviews?: { _id: string; firstName: string; lastName: string; email: string; score: number | null; answers: { questionIndex: number; questionText: string; textAnswer: string }[] }[];
  } | null>(null);
  const [assessmentApplied, setAssessmentApplied] = useState<{ moved: number; advanced: number } | null>(null);
  const [assessmentStatsData, setAssessmentStatsData] = useState<{ inAssessment: number; started: number; submitted: number; passed: number; failed: number; pending: number } | null>(null);
  const [answerKeyPublished, setAnswerKeyPublished] = useState(false);
  const [answerKeyBusy, setAnswerKeyBusy] = useState(false);
  const [answerKeyError, setAnswerKeyError] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, boolean>>({});
  const [bulkTargetStage, setBulkTargetStage] = useState<Stage>("screening");
  const [stageModal, setStageModal] = useState<{ targets: ATSCandidate[]; target: Stage } | null>(null);
  const [atsDecisionTarget, setAtsDecisionTarget] = useState<ATSCandidate | null>(null);
  const [editAppsConfirm, setEditAppsConfirm] = useState<"enable" | "disable" | null>(null);

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
    setAtsApplied(null);
    try {
      const result = await apiFetch<{ scored: number; selected: number; rejected: number; errors: number; total: number }>(`/api/recruitment/jobs/${id}/ats-score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
      setAtsResultData(result);
      setAtsLastResult(result);
      setAtsDecisionPending(true);
      setAtsAction("auto");
      void fetchCandidates({ jobId: id });
    } catch {
      setAtsResultData(null);
    } finally {
      setAtsLoading(false);
    }
  }

  async function loadAssessmentStats() {
    try {
      const res = await fetch(`/api/recruitment/jobs/${id}/assessment`);
      const data = await res.json();
      setAssessmentStatsData(data.stats || null);
      if (data.stats) {
        setAssessmentStats({ total: data.stats.submitted + data.stats.failed + data.stats.passed, passed: data.stats.passed, failed: data.stats.failed, essayReviews: data.essayReviews || [] });
      }
      setAnswerKeyPublished(Boolean(data.assessment?.answerKeyPublished));
    } catch { /* ignore */ }
  }

  async function toggleAnswerKey() {
    if (answerKeyBusy) return;
    setAnswerKeyBusy(true);
    setAnswerKeyError("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${id}/assessment/answer-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !answerKeyPublished }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string })?.error || `Server error (${res.status}).`);
      setAnswerKeyPublished(Boolean(data.published));
    } catch (e: any) {
      setAnswerKeyError(e.message);
    } finally {
      setAnswerKeyBusy(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${id}/export-candidates`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data as { error?: string })?.error || `Server error (${res.status}).`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `candidates-${id}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setExportError(e.message || "Failed to export candidates.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => { void fetchJob(id); void fetchCandidates({ jobId: id }); void loadAssessmentStats(); }, [id, fetchJob, fetchCandidates]);

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
    else if (candidateFilter === "__assessment-passed") list = list.filter((c) => (c as any).assessmentStatus === "selected");
    else if (candidateFilter === "__assessment-failed") list = list.filter((c) => (c as any).assessmentStatus === "rejected");
    else if (candidateFilter === "__assessment-pending") list = list.filter((c) => (c as any).assessmentScore == null);
    else if (candidateFilter) list = list.filter((c) => c.stage === candidateFilter);
    return list;
  }, [jobCandidates, candidateFilter]);

  const schedulableCandidates = useMemo(
    () => jobCandidates.filter((c) => !TERMINAL_STAGES.includes(c.stage) && c.atsStatus !== "rejected"),
    [jobCandidates],
  );

  const selectedCount = Object.values(selectedCandidates).filter(Boolean).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedCandidates[c.id]);

  function toggleSelectAll() {
    const next: Record<string, boolean> = {};
    if (!allFilteredSelected) for (const c of filtered) next[c.id] = true;
    setSelectedCandidates(next);
  }

  function openStageModal(candidate: ATSCandidate, target: Stage) {
    setStageModal({ targets: [candidate], target });
  }

  function openBulkStageModal() {
    const targets = filtered.filter((c) => selectedCandidates[c.id]);
    if (targets.length === 0) return;
    setStageModal({ targets, target: bulkTargetStage });
  }

  async function confirmStageChange(toStage: Stage) {
    if (!stageModal) return;
    await Promise.all(stageModal.targets.map((c) => moveCandidateStage(c.id, toStage)));
    setSelectedCandidates({});
    setStageModal(null);
    void fetchCandidates({ jobId: id });
  }

  async function atsMarkOk(candidate: ATSCandidate) {
    await setAtsDecision(candidate.id, "selected");
    void fetchCandidates({ jobId: id });
  }

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

  const accent = DEFAULT_ACCENT;
  const accentStyle = { "--accent": accent } as CSSProperties;
  const accentSoft = hexToRgba(accent, 0.12);
  const accentSofter = hexToRgba(accent, 0.06);

  const companyName = typeof activeJob.company === "object" ? (activeJob.company as any)?.name || "" : String(activeJob.company || "");
  const durationText = formatJobDuration(activeJob.durationMonths, activeJob.durationDays, activeJob.durationHours, activeJob.durationYears);
  const experienceText = activeJob.requiredExperienceMaxYears != null && activeJob.requiredExperienceYears != null && activeJob.requiredExperienceMaxYears > activeJob.requiredExperienceYears
    ? `${activeJob.requiredExperienceYears}-${activeJob.requiredExperienceMaxYears} years`
    : activeJob.requiredExperienceYears
      ? `${activeJob.requiredExperienceYears}+ years`
      : "Not specified";

  const jobFactCards = [
    { icon: MapPin, label: "Location", value: activeJob.location || "Remote / On-site" },
    { icon: Briefcase, label: "Type", value: formatEmploymentType(activeJob.employmentType) },
    { icon: Clock, label: "Duration", value: durationText || "Not specified" },
    { icon: ShieldCheck, label: "Experience", value: experienceText },
    { icon: Users, label: "Openings", value: String(activeJob.openings) },
    { icon: CalendarClock, label: "Closes", value: activeJob.autoCloseDate ? fmtDateTime(activeJob.autoCloseDate) : "Rolling" },
    { icon: Clock, label: "Assessment", value: activeJob.assessment ? (activeJob.assessmentDate ? fmtDateTime(activeJob.assessmentDate) : "Scheduled") : "Not required" },
    { icon: Users, label: "Candidates", value: `${jobCandidates.length} applied` },
  ].filter((f) => f.value !== "Not specified" && f.value !== "Not required");

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8" style={accentStyle}>
      <button
        onClick={() => router.push("/recruitment/jobs")}
        className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 transition-all hover:shadow-sm"
      >
        <ArrowLeft size={15} /> Back to jobs
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ---------- Main column ---------- */}
        <div className="min-w-0 space-y-6">
          {/* Hero */}
          <div className="overflow-hidden rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] shadow-sm">
            <div className="h-2.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${hexToRgba(accent, 0.6)})` }} />
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                        activeJob.status === "open" ? "bg-emerald-50 text-emerald-700"
                        : activeJob.status === "draft" ? "bg-amber-50 text-amber-700"
                        : "bg-[var(--c-bg-muted)] text-slate-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${activeJob.status === "open" ? "bg-emerald-500" : activeJob.status === "draft" ? "bg-amber-500" : "bg-slate-400"}`}
                      />
                      {activeJob.status}
                    </span>
                    {companyName && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-zinc-400">
                        <Building2 size={15} /> {companyName}
                      </span>
                    )}
                    {activeJob.department && <span className="text-sm text-slate-400 dark:text-zinc-500">{activeJob.department}</span>}
                  </div>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-3xl">{activeJob.title}</h1>
                </div>
                {activeJob.salaryRangeMin > 0 && (
                  <div className="inline-flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: accentSoft }}>
                    <Banknote size={18} style={{ color: accent }} />
                    <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                      {CURRENCY_SYMBOLS[activeJob.currency] || "₹"}{activeJob.salaryRangeMin.toLocaleString()} - {CURRENCY_SYMBOLS[activeJob.currency] || "₹"}{activeJob.salaryRangeMax.toLocaleString()}
                      <span className="ml-1 text-sm font-medium" style={{ color: accent }}>{salarySuffix(activeJob.salaryType)}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-zinc-400">
                {activeJob.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} /> {activeJob.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={15} /> {formatEmploymentType(activeJob.employmentType)}
                </span>
                {durationText && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} /> {durationText}
                  </span>
                )}
                {activeJob.requiredExperienceYears ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={15} /> {experienceText}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Users size={15} /> {activeJob.openings} opening{activeJob.openings > 1 ? "s" : ""} &middot; {jobCandidates.length} candidate{jobCandidates.length !== 1 ? "s" : ""}
                </span>
                {activeJob.autoCloseDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock size={15} /> Closes {fmtDateTime(activeJob.autoCloseDate)}
                  </span>
                )}
                {activeJob.assessment && activeJob.assessmentDate && (
                  <span className="inline-flex items-center gap-1.5" style={{ color: accent }}>
                    <Clock size={15} /> Assessment: {fmtDateTime(activeJob.assessmentDate)}{activeJob.assessmentDurationMinutes ? ` · ${activeJob.assessmentDurationMinutes}min` : ""}
                  </span>
                )}
              </div>

              {(atsApplied || assessmentApplied || activeJob.atsScoreThreshold != null || activeJob.assessment) && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {activeJob.assessment && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                      Assessment enabled
                    </span>
                  )}
                  {activeJob.atsScoreThreshold != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      ATS Threshold: {activeJob.atsScoreThreshold}+
                    </span>
                  )}
                  {assessmentApplied && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {assessmentApplied.advanced} advanced to Technical Interview &middot; {assessmentApplied.moved} moved to ATS Rejected
                    </span>
                  )}
                  {atsApplied && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {atsApplied.advanced} advanced to Screening &middot; {atsApplied.moved} moved to ATS Rejected
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Highlights */}
          <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Job highlights</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {jobFactCards.map((f) => (
                <div key={f.label} className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 p-3.5" style={{ backgroundColor: accentSofter }}>
                  <div className="flex items-center gap-2">
                    <f.icon size={15} style={{ color: accent }} />
                    <span className="text-xs text-slate-400 dark:text-zinc-500">{f.label}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-zinc-200">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

{/* About the role */}
          <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">About the role</h2>
            <div className="mt-3">
              {activeJob.description ? (
                <JobDescription content={activeJob.description} />
              ) : (
                <p className="text-sm text-slate-400">No description provided.</p>
              )}
            </div>
          </div>

          {/* Skills */}
          {activeJob.requiredSkills.length > 0 && (
            <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Skills &amp; requirements</h2>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {activeJob.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border px-3.5 py-1.5 text-sm font-medium"
                    style={{ backgroundColor: accentSofter, borderColor: hexToRgba(accent, 0.25), color: accent }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

      {/* Candidates */}
          <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Candidates ({jobCandidates.length})</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  {filtered.length} shown{candidateFilter ? ` · ${candidateFilter.startsWith("__ats") ? "ATS status" : candidateFilter.startsWith("__assessment") ? "assessment status" : (STAGE_LABELS[candidateFilter as Stage] ?? candidateFilter)}` : ""}
                </p>
                {isHrOrAdmin && filtered.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={() => toggleSelectAll()}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                    />
                    <button type="button" onClick={() => toggleSelectAll()} className="text-xs font-medium text-indigo-600 hover:underline">
                      {allFilteredSelected ? "Clear all" : "Select all"}
                    </button>
                  </div>
                )}
              </div>
              <select
                className="neu-inset rounded-xl px-3 py-2 text-sm"
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
                {activeJob.assessment && (
                  <optgroup label="By Assessment Status">
                    <option value="__assessment-passed">Assessment Passed</option>
                    <option value="__assessment-failed">Assessment Failed</option>
                    <option value="__assessment-pending">Not Assessed</option>
                  </optgroup>
                )}
              </select>
            </div>

            {isHrOrAdmin && selectedCount > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/40">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{selectedCount} selected</span>
                <select
                  value={bulkTargetStage}
                  onChange={(e) => setBulkTargetStage(e.target.value as Stage)}
                  className="neu-inset rounded-lg px-3 py-1.5 text-sm"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openBulkStageModal}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
                >
                  Change Stage
                </button>
                <button type="button" onClick={() => setSelectedCandidates({})} className="ml-auto text-xs font-medium text-indigo-600 hover:underline">
                  Clear
                </button>
              </div>
            )}

            {atsResultData && (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                Scored {atsResultData.scored} candidate{atsResultData.scored !== 1 ? "s" : ""} — {atsResultData.selected} selected, {atsResultData.rejected} rejected{atsResultData.errors > 0 ? `, ${atsResultData.errors} error${atsResultData.errors !== 1 ? "s" : ""}` : ""}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {filtered.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-4 transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {isHrOrAdmin && (
                      <input
                        type="checkbox"
                        checked={!!selectedCandidates[candidate.id]}
                        onChange={(e) => setSelectedCandidates((prev) => ({ ...prev, [candidate.id]: e.target.checked }))}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
                      />
                    )}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {initials(candidate.firstName, candidate.lastName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{candidate.firstName} {candidate.lastName}</span>
                        {candidate.atsScore != null && (
                          <span className="group relative inline-flex">
                            <span className={`cursor-help rounded-full px-2 py-0.5 text-xs font-bold ${candidate.atsStatus === "selected" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                              ATS {candidate.atsScore}
                            </span>
                            <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 hidden w-60 whitespace-normal rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-600 shadow-xl group-hover:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                              <span className="block font-semibold text-slate-800 dark:text-zinc-100">
                                ATS Score: {candidate.atsScore}/100 ({candidate.atsStatus === "rejected" ? "flagged" : candidate.atsStatus})
                              </span>
                              {candidate.atsReason && (
                                <span className="mt-1 block">{candidate.atsReason}</span>
                              )}
                            </span>
                          </span>
                        )}
                        {(candidate as any).assessmentStatus && (candidate as any).assessmentStatus !== "pending" && activeJob.assessment && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${(candidate as any).assessmentStatus === "selected" ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"}`}>
                            Assessment {(candidate as any).assessmentScore ?? ""}
                          </span>
                        )}
                        {candidate.atsStatus === "rejected" && candidate.stage !== "ats-rejected" && candidate.stage !== "rejected" && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">ATS-flagged, HR reviewing</span>
                        )}
                        {candidate.rating > 0 && (
                          <span className="text-sm text-amber-500">{'★'.repeat(candidate.rating)}{'☆'.repeat(5 - candidate.rating)}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-zinc-400">
                        <span>{candidate.email}</span>
                        {candidate.currentCompany && <><span>&middot;</span><span>{candidate.currentCompany}</span></>}
                        {candidate.experienceYears > 0 && <><span>&middot;</span><span>{candidate.experienceYears}y exp</span></>}
                      </div>
                      {candidate.atsRejectionNote && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-rose-600">
                          <span className="font-medium">Rejected:</span> {candidate.atsRejectionNote}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isHrOrAdmin && candidate.atsStatus === "rejected" && candidate.stage !== "ats-rejected" && candidate.stage !== "rejected" && (
                      <>
                        <button
                          onClick={() => void atsMarkOk(candidate)}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          title="Keep the candidate in the pipeline (override the ATS flag)"
                        >
                          Mark OK
                        </button>
                        <button
                          onClick={() => setAtsDecisionTarget(candidate)}
                          className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          title="Move the candidate to ATS Rejected (with an optional note)"
                        >
                          ATS Reject
                        </button>
                      </>
                    )}
                    {isHrOrAdmin ? (
                      <span className="relative inline-flex items-center">
                        <select
                          value={candidate.stage}
                          onChange={(e) => openStageModal(candidate, e.target.value as Stage)}
                          className={`cursor-pointer appearance-none rounded-full py-0.5 pl-2.5 pr-6 text-xs font-medium ${stagePillClass(candidate.stage)}`}
                          title={`Move ${candidate.firstName} ${candidate.lastName} to another stage`}
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-1.5 text-current opacity-60" />
                      </span>
                    ) : (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stagePillClass(candidate.stage)}`}>
                        {STAGE_LABELS[candidate.stage]}
                      </span>
                    )}
                    <button
                      onClick={() => router.push(`/recruitment/candidates/${candidate.id}`)}
                      className="rounded-lg border border-[var(--c-border-light)] px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
                    >
                      Profile
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500">No candidates found.</p>
              )}
            </div>
          </div>
        </div>

        {/* ---------- Sticky sidebar ---------- */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Quick actions */}
          <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Quick actions</h3>
            <div className="mt-4 space-y-2.5">
              <button
                onClick={() => setModal({ type: "create-candidate", jobId: id })}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                <UserPlus size={16} /> Add Candidate
              </button>
              {isHrOrAdmin && (
                <ActionButton accent={accent} icon={CalendarPlus} label="Schedule Interview" onClick={() => setBulkIvOpen(true)} />
              )}
              {isHrOrAdmin && (
                <ActionButton accent={accent} icon={Cog} label={atsLoading ? "Scoring…" : "Run ATS Score"} disabled={atsLoading} onClick={() => { if (!atsLoading) void handleRunAts(false); }} />
              )}
              {isHrOrAdmin && (
                <ActionButton accent={accent} icon={Cog} label="Re-score All" disabled={atsLoading} onClick={() => { if (!atsLoading) void handleRunAts(true); }} />
              )}
              {isHrOrAdmin && (
                <ActionButton
                  accent={accent}
                  icon={activeJob?.editApplicationsEnabled ? PencilOff : Pencil}
                  label={activeJob?.editApplicationsEnabled ? "Disable edit application" : "Enable edit application"}
                  onClick={() => setEditAppsConfirm(activeJob?.editApplicationsEnabled ? "disable" : "enable")}
                />
              )}
              {atsDecisionPending && atsLastResult && (
                <ActionButton accent={accent} icon={Check} label="Review ATS timelines" onClick={() => setAtsResultData(atsLastResult)} />
              )}
              {isHrOrAdmin && activeJob.assessment && (
                <ActionButton accent={accent} icon={Cog} label="Manage Assessment" onClick={() => setAssessmentManagerOpen(true)} />
              )}
              {isHrOrAdmin && activeJob.assessment && assessmentStats && assessmentStats.total > 0 && (
                <ActionButton accent={accent} icon={Check} label="Review Assessment Results" onClick={() => { void loadAssessmentStats(); setAssessmentResultsOpen(true); }} />
              )}
              {isHrOrAdmin && activeJob.status === "closed" && (
                <ActionButton accent={accent} icon={Download} label={exporting ? "Exporting…" : "Export Candidates"} disabled={exporting} onClick={() => { void handleExport(); }} />
              )}
              {isHrOrAdmin && activeJob.assessment && assessmentCandidatesVisible(activeJob.assessmentDate) && (
                <ActionButton accent={accent} icon={Users} label="Assessment Candidates" onClick={() => { void fetchCandidates({ jobId: id }); setAssessmentCandidatesOpen(true); }} />
              )}
              {isHrOrAdmin && activeJob.assessment && assessmentResultsUnlocked({ assessment: activeJob.assessment, assessmentDate: activeJob.assessmentDate }) && (
                <ActionButton
                  accent={accent}
                  icon={Check}
                  label={answerKeyBusy ? "Saving…" : answerKeyPublished ? "Unpublish Answer Key" : "Publish Answer Key"}
                  disabled={answerKeyBusy}
                  onClick={() => void toggleAnswerKey()}
                />
              )}
              {answerKeyError && <p className="text-xs text-rose-600">{answerKeyError}</p>}
              {exportError && <p className="text-xs text-rose-600">{exportError}</p>}
            </div>

            <div className="mt-4 space-y-2.5 border-t border-[var(--c-border-light)] dark:border-zinc-800 pt-4">
              {activeJob.status === "draft" && isAdmin && (
                <ActionButton accent={accent} icon={Globe} label="Publish Job" onClick={() => { void updateJob(id, { status: "open" as JobStatus }); }} />
              )}
              {activeJob.status === "open" && isAdmin && (
                <ActionButton accent={accent} icon={Archive} label="Close Job" onClick={() => { void updateJob(id, { status: "closed" as JobStatus }); }} />
              )}
              {activeJob.status === "open" && (
                <ActionButton
                  accent={accent}
                  icon={copied ? Check : Share2}
                  label={copied ? "Link copied!" : "Share job"}
                  onClick={() => {
                    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const url = slug ? `${window.location.origin}/careers/jobs/${slug}/${id}` : "";
                    if (url) navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
                  }}
                />
              )}
              <ActionButton accent={accent} icon={Pencil} label="Edit job" onClick={() => router.push(`/recruitment/jobs/${id}/edit`)} />
              <ActionButton accent={accent} icon={Columns3} label="Kanban board" onClick={() => router.push(`/recruitment/jobs/${id}/board`)} />
              {activeJob.status !== "open" && (
                <ActionButton accent={accent} icon={Trash2} label="Delete job" danger onClick={() => setModal({ type: "delete-job", jobId: id })} />
              )}
            </div>
          </div>

          {/* Job details */}
          <div className="rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#000000] p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: accent }}>
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{companyName || "Your company"}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Recruitment on FlowZen</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-[var(--c-border-light)] dark:border-zinc-800 pt-5">
              <SideRow accent={accent} icon={Briefcase} label="Position" value={activeJob.title} />
              {activeJob.department && <SideRow accent={accent} icon={Building2} label="Department" value={activeJob.department} />}
              <SideRow accent={accent} icon={MapPin} label="Location" value={activeJob.location || "Remote / On-site"} />
              <SideRow accent={accent} icon={Users} label="Openings" value={String(activeJob.openings)} />
              <SideRow accent={accent} icon={Clock} label="Type" value={formatEmploymentType(activeJob.employmentType)} />
              <SideRow accent={accent} icon={ShieldCheck} label="Experience" value={experienceText} />
              {durationText && <SideRow accent={accent} icon={Clock} label="Duration" value={durationText} />}
              {activeJob.atsScoreThreshold != null && <SideRow accent={accent} icon={Cog} label="ATS threshold" value={`${activeJob.atsScoreThreshold}+`} />}
              {activeJob.assessment && (
                <SideRow
                  accent={accent}
                  icon={Clock}
                  label="Assessment"
                  value={activeJob.assessmentDate ? `${fmtDateTime(activeJob.assessmentDate)}${activeJob.assessmentDurationMinutes ? ` · ${activeJob.assessmentDurationMinutes}min` : ""}` : "Scheduled"}
                />
              )}
              <SideRow accent={accent} icon={CalendarClock} label="Closes" value={activeJob.autoCloseDate ? fmtDateTime(activeJob.autoCloseDate) : "Rolling"} />
              {activeJob.salaryRangeMin > 0 && (
                <SideRow
                  accent={accent}
                  icon={Banknote}
                  label="Salary range"
                  highlight
                  value={`${CURRENCY_SYMBOLS[activeJob.currency] || "₹"}${activeJob.salaryRangeMin.toLocaleString()} - ${CURRENCY_SYMBOLS[activeJob.currency] || "₹"}${activeJob.salaryRangeMax.toLocaleString()} ${salarySuffix(activeJob.salaryType)}`}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>

      <DeleteJobModal id={id} />
      <CandidateModal jobId={id} employmentType={activeJob?.employmentType} />
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
          try {
            const res = await apiFetch<{ moved: number; advanced: number; mode: string }>(`/api/recruitment/jobs/${id}/ats-apply-rejections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: action, note }) });
            if (action === "auto") setAtsApplied({ moved: res.moved, advanced: res.advanced });
            void fetchCandidates({ jobId: id });
          } catch {}
          setAtsDecisionPending(false);
          setAtsResultData(null);
        }}
      />
      <BulkInterviewModal
        open={bulkIvOpen}
        onClose={() => setBulkIvOpen(false)}
        jobId={id}
        jobLocation={activeJob?.location ?? ""}
        candidates={schedulableCandidates}
        onDone={() => { void fetchCandidates({ jobId: id }); }}
      />
      {stageModal && (
        <StageChangeModal
          data={stageModal}
          onClose={() => setStageModal(null)}
          onConfirm={confirmStageChange}
        />
      )}
      <AtsDecisionModal
        candidate={atsDecisionTarget}
        onClose={() => setAtsDecisionTarget(null)}
        onSubmit={async (candidate, note) => {
          setAtsDecisionTarget(null);
          await setAtsDecision(candidate.id, "rejected", note);
          void fetchCandidates({ jobId: id });
        }}
      />
      {editAppsConfirm && (
        <EditApplicationsModal
          mode={editAppsConfirm}
          onClose={() => setEditAppsConfirm(null)}
          onConfirm={async () => {
            await updateJob(id, {
              action: editAppsConfirm === "enable" ? "enable-edit-applications" : "disable-edit-applications",
            });
          }}
        />
      )}
      {assessmentManagerOpen && <AssessmentManagerModal jobId={id} onClose={() => { setAssessmentManagerOpen(false); void loadAssessmentStats(); }} />}
      {assessmentCandidatesOpen && (
        <AssessmentCandidatesModal
          candidates={jobCandidates.filter((c) => c.stage === "screening" || c.stage === "assessment")}
          onClose={() => setAssessmentCandidatesOpen(false)}
        />
      )}
      {assessmentResultsOpen && (
        <AssessmentResultsModal
          data={assessmentStats}
          jobId={id}
          onClose={() => setAssessmentResultsOpen(false)}
          onSubmit={async (mode, note) => {
            const res = await fetch(`/api/recruitment/jobs/${id}/assessment-apply-rejections`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode, note }),
            });
            const data = await res.json();
            if (mode === "auto") setAssessmentApplied({ moved: data.moved, advanced: data.advanced });
            setAssessmentResultsOpen(false);
            void fetchCandidates({ jobId: id });
            void loadAssessmentStats();
          }}
        />
      )}
    </>
  );
}

function ActionButton({
  accent,
  icon: Icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  accent: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-300 transition-all hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: danger ? hexToRgba("#ef4444", 0.1) : hexToRgba(accent, 0.1) }}
      >
        <Icon size={15} style={{ color: danger ? "#dc2626" : accent }} />
      </span>
      {label}
    </button>
  );
}

function SideRow({
  accent,
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  accent: string;
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: hexToRgba(accent, 0.1) }}>
        <Icon size={15} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-zinc-500">{label}</p>
        <p className={`break-words text-sm ${highlight ? "font-semibold text-slate-900 dark:text-zinc-100" : "text-slate-700 dark:text-zinc-300"}`}>
          {value}
        </p>
      </div>
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
  action: "auto" | "manual";
  onActionChange: (value: "auto" | "manual") => void;
  onMarkLater: () => void;
  onSubmit: (action: "auto" | "manual", note: string) => void;
}) {
  const [note, setNote] = useState("");
  if (!result) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">Update candidate timelines from ATS results?</h2>
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
          <label className="mt-4 block text-sm font-medium text-slate-700">ATS timeline action</label>
          <select
            value={action}
            onChange={(e) => onActionChange(e.target.value as "auto" | "manual")}
            className="neu-inset mt-1 w-full rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="auto">Auto-advance (reject ATS-failed, move approved to Screening)</option>
            <option value="manual">Manual review (leave stages as-is)</option>
          </select>
          {action === "auto" && (
            <p className="mt-1 text-xs text-slate-500">
              Approved candidates still in Applied will be moved to Screening. Rejected candidates will be moved to the ATS Rejected stage. Offer and Joined stages are never auto-changed.
            </p>
          )}
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

function AtsDecisionModal({
  candidate,
  onClose,
  onSubmit,
}: {
  candidate: ATSCandidate | null;
  onClose: () => void;
  onSubmit: (candidate: ATSCandidate, note: string) => void;
}) {
  const [note, setNote] = useState("");
  if (!candidate) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">Reject {candidate.firstName} {candidate.lastName} via ATS</h2>
          <p className="mt-2 text-sm text-slate-600">
            This will move the candidate to the <span className="font-medium">ATS Rejected</span> stage and record a rejection note on their timeline.
          </p>
          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700">Rejection note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Type a reason for rejection. If left empty, an automatic ATS-based reason (score vs. threshold) will be recorded."
              className="neu-inset mt-1 w-full resize-none rounded-lg px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              {note.trim() ? "A manual note will be saved." : "An auto note (score vs. threshold + ATS reason) will be saved."}
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(candidate, note.trim())}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              ATS Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditApplicationsModal({
  mode,
  onClose,
  onConfirm,
}: {
  mode: "enable" | "disable";
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const enabled = mode === "enable";

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-sm rounded-lg neu-card">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {enabled ? "Enable edit application?" : "Disable edit application?"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {enabled
              ? "All candidates who applied to this job will receive an email inviting them to update their application (name, phone, resume, portfolio, LinkedIn)."
              : "Candidates will no longer be able to edit their application. No notification will be sent to candidates."}
          </p>
          {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={saving}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                enabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? (enabled ? "Enabling…" : "Disabling…") : enabled ? "Yes, Enable" : "Yes, Disable"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteJobModal({ id }: { id: string }) {
  const router = useRouter();
  const { modal, setModal, deleteJob, activeJob, saving } = useRecruitmentStore();
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
              onClick={async () => { if (saving) return; await deleteJob(id); setModal(null); router.push("/recruitment/jobs"); }}
              disabled={saving}
              className="neu-btn neu-btn-danger rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageChangeModal({
  data,
  onClose,
  onConfirm,
}: {
  data: { targets: ATSCandidate[]; target: Stage };
  onClose: () => void;
  onConfirm: (stage: Stage) => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>(data.target);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const single = data.targets.length === 1;
  const subject = single ? `${data.targets[0].firstName} ${data.targets[0].lastName}` : `${data.targets.length} candidates`;

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm(stage);
      onClose();
    } catch {
      setError("Failed to update stage. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-sm rounded-lg neu-card">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">{single ? "Move Candidate" : `Move ${data.targets.length} Candidates`}</h2>
          {single ? (
            <p className="mt-2 text-sm text-slate-600">
              Move <span className="font-medium text-slate-800">{subject}</span> from{" "}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stagePillClass(data.targets[0].stage)}`}>
                {STAGE_LABELS[data.targets[0].stage]}
              </span>
            </p>
          ) : (
            <div className="mt-2">
              <p className="text-sm text-slate-600">Change the stage of {subject}:</p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-lg bg-[var(--c-bg-muted)] p-2">
                {data.targets.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="min-w-0 truncate">{c.firstName} {c.lastName}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${stagePillClass(c.stage)}`}>
                      {STAGE_LABELS[c.stage]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Move to</span>
            <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className="neu-inset w-full rounded-lg px-3 py-2 text-sm">
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </label>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={saving}
              className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Moving…" : single ? "Move" : `Move ${data.targets.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  icon,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</span>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          min={min}
          className={`neu-inset w-full rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500 ${icon ? "pl-10" : ""}`}
        />
      </div>
    </label>
  );
}

function CandidateModal({ jobId, employmentType }: { jobId: string; employmentType?: string }) {
  const { modal, setModal, createCandidate, uploadResume, saving } = useRecruitmentStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [internshipExperienceMonths, setInternshipExperienceMonths] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [knowEmployee, setKnowEmployee] = useState(false);
  const [referralId, setReferralId] = useState("");
  const [referralStatus, setReferralStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
  const [referralName, setReferralName] = useState("");
  const [referralCompanyName, setReferralCompanyName] = useState("");
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailDuplicate, setEmailDuplicate] = useState<{ firstName: string; lastName: string; stage: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (modal?.type !== "create-candidate") return;
    setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setCurrentCompany("");
    setExperienceYears(""); setInternshipExperienceMonths(""); setNoticePeriod(""); setNotes("");
    setResumeFile(null); setPortfolioUrl(""); setLinkedInUrl("");
    setKnowEmployee(false); setReferralId(""); setReferralStatus("idle"); setReferralName(""); setReferralCompanyName("");
    setEmailChecking(false); setEmailDuplicate(null); setError("");
  }, [modal?.type]);

  useEffect(() => {
    const emailValue = email.trim().toLowerCase();
    if (!emailValue || !jobId) {
      setEmailDuplicate(null);
      setEmailChecking(false);
      return;
    }
    setEmailChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/jobs/${jobId}/check-email?email=${encodeURIComponent(emailValue)}`);
        setEmailDuplicate(res.ok ? (await res.json()).candidate ?? null : null);
      } catch {
        setEmailDuplicate(null);
      } finally {
        setEmailChecking(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [email, jobId]);

  useEffect(() => {
    if (!knowEmployee || !referralId.trim() || !jobId) {
      setReferralStatus("idle");
      return;
    }
    const timer = setTimeout(async () => {
      setReferralStatus("verifying");
      try {
        const res = await fetch(`/api/public/jobs/${jobId}/verify-referral?referralId=${encodeURIComponent(referralId)}`);
        if (!res.ok) {
          setReferralStatus("error");
          return;
        }
        const data = await res.json();
        setReferralName(data.name);
        setReferralCompanyName(data.company);
        setReferralStatus("verified");
      } catch {
        setReferralStatus("error");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [referralId, knowEmployee, jobId]);

  if (modal?.type !== "create-candidate") return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    if (!resumeFile) {
      setError("Resume / CV is required.");
      return;
    }
    setError("");
    const isReferral = knowEmployee && referralStatus === "verified" && referralId.trim().length > 0;
    const data: Record<string, unknown> = {
      firstName,
      lastName,
      email,
      phone,
      currentCompany,
      experienceYears: Number(experienceYears) || 0,
      internshipExperienceMonths: Number(internshipExperienceMonths) || 0,
      noticePeriod: Number(noticePeriod) || 0,
      notes,
      portfolioUrl,
      linkedInUrl,
      source: isReferral ? "Referral" : "Other",
      referralId: isReferral ? referralId : "",
      job: jobId,
    };
    try {
      const created = await createCandidate(data);
      if (created?.id && resumeFile) {
        await uploadResume(created.id, resumeFile);
      }
      setModal(null);
    } catch {
      setError("Failed to add candidate. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-lg rounded-lg neu-card">
        <div className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
          <h2 className="text-base font-semibold">Add Candidate</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form className="space-y-5 p-5 max-h-[80vh] overflow-y-auto" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput label="First Name" value={firstName} onChange={setFirstName} required placeholder="John" />
            <FieldInput label="Last Name" value={lastName} onChange={setLastName} placeholder="Doe" />
            <div className="sm:col-span-2">
              <FieldInput label="Email" value={email} onChange={setEmail} type="email" required placeholder="you@email.com" />
              {emailChecking && <p className="mt-1.5 text-xs text-slate-400 dark:text-zinc-500">Checking if you have already applied...</p>}
              {!emailChecking && emailDuplicate && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                  A candidate with this email already exists for this job{emailDuplicate.firstName ? ` (${emailDuplicate.firstName} ${emailDuplicate.lastName || ""})` : ""}. You can still add them if you want to.
                </p>
              )}
            </div>
          </div>
          <FieldInput label="Phone" value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput label="Current Company" value={currentCompany} onChange={setCurrentCompany} placeholder="Acme Inc." />
            <FieldInput label="Years of Experience" value={experienceYears} onChange={setExperienceYears} type="number" min="0" placeholder="5" />
          </div>
          {employmentType === "internship" && (
            <FieldInput label="Experience in Internship (months)" value={internshipExperienceMonths} onChange={setInternshipExperienceMonths} type="number" min="0" placeholder="6" />
          )}
          <FieldInput label="Notice Period (days)" value={noticePeriod} onChange={setNoticePeriod} type="number" min="0" placeholder="30" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Cover Letter / Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="neu-inset w-full resize-y rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 dark:bg-[#000000] px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500"
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 p-5">
            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-zinc-300">Do you know anyone working at this company?</p>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                <input type="radio" name="knowEmployee" checked={knowEmployee === true} onChange={() => setKnowEmployee(true)} className="text-slate-900" />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                <input type="radio" name="knowEmployee" checked={knowEmployee === false} onChange={() => setKnowEmployee(false)} className="text-slate-900" />
                No
              </label>
            </div>
            {knowEmployee && (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Employee Referral ID</label>
                <div className="relative">
                  <input
                    value={referralId}
                    onChange={(e) => setReferralId(e.target.value)}
                    placeholder="HELLO-COMPANY-41279814"
                    className="neu-inset w-full rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 dark:bg-[#000000] px-4 py-3 pr-12 text-sm text-slate-900 dark:text-zinc-100 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                  />
                  {referralStatus === "verifying" && (
                    <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                  {referralStatus === "verified" && (
                    <CheckCircle size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
                {referralStatus === "verified" && (
                  <p className="mt-2 text-xs text-emerald-600">Verified: {referralName} ({referralCompanyName})</p>
                )}
                {referralStatus === "error" && (
                  <p className="mt-2 text-xs text-rose-500">Referral employee not found. Please check the referral ID.</p>
                )}
                {referralStatus === "idle" && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">Enter the referral ID provided by the employee.</p>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Resume / CV *</label>
              {resumeFile && <span className="mb-1.5 text-xs text-slate-500">{resumeFile.name}</span>}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 px-4 py-3">
              <Upload size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                required
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > 2 * 1024 * 1024) {
                    setError("File exceeds 2 MB limit.");
                    e.target.value = "";
                    return;
                  }
                  setError("");
                  setResumeFile(file);
                }}
                className="w-full cursor-pointer text-sm text-slate-500 dark:text-zinc-400 outline-none file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-white file:shadow-sm file:transition-all hover:file:opacity-90"
              />
              <style>{`input[type="file"]::file-selector-button { background-color: ${DEFAULT_ACCENT}; }`}</style>
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">PDF, DOC, DOCX, PNG, or JPG — max 2 MB</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput label="Portfolio URL" value={portfolioUrl} onChange={setPortfolioUrl} placeholder="https://" icon={<ExternalLink size={14} />} />
            <FieldInput label="LinkedIn URL" value={linkedInUrl} onChange={setLinkedInUrl} placeholder="https://linkedin.com/in/" icon={<ExternalLink size={14} />} />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button type="submit" disabled={saving} className="neu-btn neu-btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Adding…" : "Add Candidate"}
          </button>
        </form>
      </div>
    </div>
  );
}

function BulkInterviewModal({
  open,
  onClose,
  jobId,
  jobLocation,
  candidates,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobLocation?: string;
  candidates: any[];
  onDone: () => void;
}) {
  const [pickerRole, setPickerRole] = useState("human-resource");
  const [pickerUsers, setPickerUsers] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>(Object.keys(INTERVIEWER_ROLES));
  const [meetingType, setMeetingType] = useState("online");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isRemoteJob = !!jobLocation && /^remote$/i.test(jobLocation.trim());

  useEffect(() => {
    let active = true;
    apiFetch<{ availableRoles: string[] }>("/api/recruitment/interviewer-roles")
      .then((res) => {
        if (!active) return;
        const roles = res.availableRoles ?? [];
        setAvailableRoles(roles.length ? roles : Object.keys(INTERVIEWER_ROLES));
        setPickerRole((prev) => (roles.includes(prev) ? prev : roles[0] || prev));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setPickerLoading(true);
    const region = jobLocation && !isRemoteJob ? `&region=${encodeURIComponent(jobLocation)}` : "";
    apiFetch<{ users: any[] }>(`/api/recruitment/users-by-role?role=${pickerRole}${region}`)
      .then((res) => { if (active) setPickerUsers(res.users ?? []); })
      .catch(() => { if (active) setPickerUsers([]); })
      .finally(() => { if (active) setPickerLoading(false); });
    return () => { active = false; };
  }, [open, pickerRole, isRemoteJob, jobLocation]);

  if (!open) return null;

  const allSelected = candidates.length > 0 && candidates.every((c) => selected[String((c as any)._id || c.id)]);

  function toggleAll() {
    const next: Record<string, boolean> = {};
    if (!allSelected) {
      for (const c of candidates) next[String((c as any)._id || c.id)] = true;
    }
    setSelected(next);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const form = new FormData(e.currentTarget);
    const candidateIds = candidates
      .map((c) => String((c as any)._id || c.id))
      .filter((cid) => selected[cid]);
    if (candidateIds.length === 0) {
      setError("Select at least one candidate.");
      return;
    }
    const isOnline = meetingType === "online";
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/recruitment/jobs/${jobId}/bulk-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewer: String(form.get("interviewer") || ""),
          roundType: String(form.get("roundType") || "screening"),
          scheduledAt: String(form.get("scheduledAt") || ""),
          meetingLink: isOnline ? String(form.get("meetingLink") || "") : "",
          location: isOnline ? "" : String(form.get("location") || ""),
          candidateIds,
        }),
      });
      setSelected({});
      onClose();
      onDone();
    } catch {
      setError("Failed to schedule interviews. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-lg rounded-lg neu-card">
        <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
          <h2 className="text-base font-semibold">Schedule Bulk Interviews</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <form className="space-y-4 p-5 max-h-[80vh] overflow-y-auto" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Round Type</span>
              <select name="roundType" className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm">
                <option value="screening">Screening</option>
                <option value="technical">Technical</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Scheduled At</span>
              <input name="scheduledAt" type="datetime-local" required className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Interviewer</span>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Role</span>
                <select value={pickerRole} onChange={(e) => setPickerRole(e.target.value)} className="neu-inset rounded-lg px-3 py-2.5 text-sm">
                  {Object.entries(INTERVIEWER_ROLES)
                    .filter(([value]) => availableRoles.includes(value))
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </label>
              <label className="block min-w-[200px] flex-1">
                <span className="mb-1 block text-xs text-slate-500">{pickerLoading ? "Loading interviewers..." : "Interviewer"}</span>
                <select name="interviewer" required className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm">
                  <option value="">Select an interviewer...</option>
                  {pickerUsers.length === 0 && !pickerLoading && <option value="">No users found</option>}
                  {pickerUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </label>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Meeting Type</span>
            <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm">
              <option value="online">Online (meeting link)</option>
              <option value="in-person">In-person (location)</option>
            </select>
          </label>
          {meetingType === "online" ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Meeting Link</span>
              <input name="meetingLink" placeholder="https://meet.google.com/..." className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm" />
            </label>
          ) : (
            <InterviewLocationFields jobLocation={jobLocation} />
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Candidates ({Object.values(selected).filter(Boolean).length} selected)</span>
              <button type="button" onClick={toggleAll} className="text-xs font-medium text-indigo-600 hover:underline">
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--c-border-light)]">
              {candidates.length === 0 && <p className="p-3 text-sm text-slate-400">No candidates in this job yet.</p>}
              {candidates.map((c) => {
                const cid = String((c as any)._id || c.id);
                return (
                  <label key={cid} className="flex cursor-pointer items-center gap-3 border-b border-[var(--c-border-light)] px-3 py-2 last:border-b-0 hover:bg-[var(--c-bg-muted)]">
                    <input
                      type="checkbox"
                      checked={!!selected[cid]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [cid]: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    <span className="flex-1 text-sm text-slate-700">
                      {(c as any).firstName} {(c as any).lastName}
                    </span>
                    {(c as any).atsScore != null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${(c as any).atsStatus === "selected" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        ATS {(c as any).atsScore}
                      </span>
                    )}
                    {(c as any).assessmentScore != null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${(c as any).assessmentStatus === "selected" ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"}`}>
                        Assessment {(c as any).assessmentScore}%
                      </span>
                    )}
                    {selected[cid] && (c as any).email && (
                      <span className="text-xs text-slate-400">{c.email}</span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {STAGE_LABELS[(c as any).stage as Stage] || (c as any).stage}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="neu-btn neu-btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Scheduling…" : "Schedule Selected"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
