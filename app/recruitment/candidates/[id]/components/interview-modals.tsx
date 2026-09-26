"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { apiFetch } from "@/lib/client-utils";
import { InterviewLocationFields } from "@/components/recruitment/interview-location-fields";
import {
  MeetingModeFields,
  useFlowZenQuota,
  type MeetingMode,
} from "@/components/recruitment/interview-room/meeting-mode-fields";
import { isExternalVideoProvider, normalizeVideoProvider, type VideoProvider } from "@/lib/interview-provider";
import { ResumeViewerModal } from "@/components/recruitment/resume-viewer-modal";
import { JobDescription } from "@/components/recruitment/job-description";
import { Download, Lock, Video } from "lucide-react";

const INTERVIEWER_ROLES: Record<string, string> = {
  "project-manager": "Project Manager",
  "qa-tester": "QA Tester",
  finance: "Finance",
  "human-resource": "HR",
  admin: "Admin",
  "it-admin": "IT Admin",
  "it-administration": "IT Administrative",
};

function getStatusClasses(status: string) {
  switch (status) {
    case "completed": return "bg-emerald-50 text-emerald-700";
    case "cancelled": return "bg-rose-50 text-rose-700";
    case "in-progress": return "bg-amber-50 text-amber-700";
    case "scheduled": return "bg-slate-100 text-slate-700";
    case "rescheduled": return "bg-zinc-100 text-zinc-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

function ScoreStatusBadge({ status }: { status: string }) {
  if (status === "selected")
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Selected</span>;
  if (status === "rejected")
    return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Rejected</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Pending</span>;
}

function AtsStatusBadge({ status, terminal }: { status: string; terminal: boolean }) {
  if (status === "selected")
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Selected</span>;
  if (status === "rejected" && !terminal)
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Flagged · HR reviewing</span>;
  if (status === "rejected")
    return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Rejected</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Pending</span>;
}

function ScheduleInterviewModal({
  candidateId,
  jobLocation,
  onIvChange,
}: {
  candidateId: string;
  jobLocation?: string;
  onIvChange: () => void;
}) {
  const { setModal, createInterview, saving } = useRecruitmentStore();
  const [pickerRole, setPickerRole] = useState("human-resource");
  const [pickerUsers, setPickerUsers] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>(Object.keys(INTERVIEWER_ROLES));
  const [mode, setMode] = useState<MeetingMode>("flowzen");
  const [provider, setProvider] = useState<Exclude<VideoProvider, "flowzen">>("zoom");
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingPassword, setMeetingPassword] = useState("");
  const [formError, setFormError] = useState("");
  const quota = useFlowZenQuota();

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
    let active = true;
    setPickerLoading(true);
    const region =
      jobLocation && !isRemoteJob
        ? `&region=${encodeURIComponent(jobLocation)}`
        : "";
    apiFetch<{ users: any[] }>(`/api/recruitment/users-by-role?role=${pickerRole}${region}`)
      .then((res) => {
        if (active) setPickerUsers(res.users ?? []);
      })
      .catch(() => {
        if (active) setPickerUsers([]);
      })
      .finally(() => {
        if (active) setPickerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pickerRole, isRemoteJob]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setFormError("");
    const form = new FormData(e.currentTarget);

    if (quota?.exhausted && mode === "flowzen") {
      setFormError(
        "You have used all FlowZen video rooms this month. Choose Zoom, Google Meet or an in-person interview."
      );
      return;
    }
    if (mode === "external" && !meetingLink.trim()) {
      setFormError(`Enter the ${provider === "zoom" ? "Zoom" : "Google Meet"} meeting link.`);
      return;
    }

    try {
      await createInterview({
        candidate: candidateId,
        interviewer: String(form.get("interviewer") || ""),
        roundType: String(form.get("roundType") || "screening") as any,
        scheduledAt: String(form.get("scheduledAt") || ""),
        videoProvider: mode === "external" ? provider : "flowzen",
        meetingLink: mode === "external" ? meetingLink : "",
        meetingPassword: mode === "external" ? meetingPassword : "",
        location: mode === "in-person" ? String(form.get("location") || "") : "",
      });
      onIvChange();
      setModal(null);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Failed to schedule the interview.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
          <h2 className="text-base font-semibold">Schedule Interview</h2>
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
            onClick={() => setModal(null)}
            type="button"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Round Type
            </span>
            <select
              name="roundType"
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="screening">Screening</option>
              <option value="technical">Technical</option>
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Interviewer
            </span>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Role</span>
                <select
                  value={pickerRole}
                  onChange={(e) => setPickerRole(e.target.value)}
                  className="neu-inset rounded-lg px-3 py-2.5 text-sm"
                >
                  {Object.entries(INTERVIEWER_ROLES)
                    .filter(([value]) => availableRoles.includes(value))
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block min-w-[200px] flex-1">
                <span className="mb-1 block text-xs text-slate-500">
                  {pickerLoading ? "Loading interviewers..." : "Interviewer"}
                </span>
                <select
                  name="interviewer"
                  required
                  className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="">Select an interviewer...</option>
                  {pickerUsers.length === 0 && !pickerLoading && (
                    <option value="">No users found</option>
                  )}
                  {pickerUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {jobLocation && !isRemoteJob && (
              <p className="mt-1 text-xs text-slate-500">
                Interviewers shown for region "{jobLocation}".
              </p>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Scheduled At
            </span>
            <input
              name="scheduledAt"
              type="datetime-local"
              required
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
          <MeetingModeFields
            mode={mode}
            onModeChange={setMode}
            provider={provider}
            onProviderChange={setProvider}
            meetingLink={meetingLink}
            onMeetingLinkChange={setMeetingLink}
            meetingPassword={meetingPassword}
            onMeetingPasswordChange={setMeetingPassword}
            quota={quota}
            locationFields={<InterviewLocationFields jobLocation={jobLocation} />}
          />
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="neu-btn neu-btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Scheduling…" : "Schedule"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AddFeedbackModal({
  interviewId,
  onIvChange,
}: {
  interviewId: string;
  onIvChange: () => void;
}) {
  const { setModal, addFeedback, saving } = useRecruitmentStore();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const form = new FormData(e.currentTarget);
    await addFeedback(interviewId, {
      technicalSkills: Number(form.get("technicalSkills") || 3),
      communication: Number(form.get("communication") || 3),
      problemSolving: Number(form.get("problemSolving") || 3),
      cultureFit: Number(form.get("cultureFit") || 3),
      overallRecommendation: String(
        form.get("recommendation") || "hold",
      ) as any,
      notes: String(form.get("notes") || ""),
    });
    onIvChange();
    setModal(null);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
          <h2 className="text-base font-semibold">Interview Feedback</h2>
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
            onClick={() => setModal(null)}
            type="button"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            {[
              "technicalSkills",
              "communication",
              "problemSolving",
              "cultureFit",
            ].map((field) => (
              <label key={field} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 capitalize">
                  {field.replace(/([A-Z])/g, " $1")}
                </span>
                <select
                  name={field}
                  defaultValue="3"
                  className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Overall Recommendation
            </span>
            <select
              name="recommendation"
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="strong-hire">Strong Hire</option>
              <option value="hire">Hire</option>
              <option value="hold">Hold</option>
              <option value="reject">Reject</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Notes
            </span>
            <textarea
              name="notes"
              rows={3}
              className="neu-inset w-full resize-y rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="neu-btn neu-btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Submit Feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Formats an ISO timestamp for a datetime-local input, keeping the wall-clock
 * time the interview was scheduled at instead of shifting it through UTC.
 */
function toDatetimeLocal(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EditInterviewModal({
  interviewId,
  candidateInterviews,
  onIvChange,
}: {
  interviewId: string;
  candidateInterviews: any[];
  onIvChange: () => void;
}) {
  const { setModal, updateInterview, saving } = useRecruitmentStore();
  const interview = candidateInterviews.find((i) => i.id === interviewId);
  const existingProvider = normalizeVideoProvider(interview?.videoProvider);
  const isInPerson = interview?.meetingType === "in-person" || Boolean(interview?.location);
  const [mode, setMode] = useState<MeetingMode>(
    isInPerson ? "in-person" : isExternalVideoProvider(existingProvider) ? "external" : "flowzen"
  );
  const [provider, setProvider] = useState<Exclude<VideoProvider, "flowzen">>(
    isExternalVideoProvider(existingProvider) ? existingProvider : "zoom"
  );
  const [meetingLink, setMeetingLink] = useState<string>(interview?.meetingLink || "");
  const [meetingPassword, setMeetingPassword] = useState<string>(interview?.meetingPassword || "");
  const [formError, setFormError] = useState("");
  const quota = useFlowZenQuota();
  // A FlowZen room that is already attached to this interview does not consume
  // a new quota slot, so an exhausted allowance must not block editing it.
  const hasFlowZenRoom = String(interview?.meetingLink || "").includes("/recruitment/interview/");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setFormError("");
    const form = new FormData(e.currentTarget);
    const updates: Record<string, any> = {};
    const scheduledAt = String(form.get("scheduledAt") || "");
    if (scheduledAt) updates.scheduledAt = scheduledAt;
    const location = String(form.get("location") || "");

    if (mode === "in-person" && !location) {
      setFormError("Enter the interview location.");
      return;
    }
    if (mode === "external" && !meetingLink.trim()) {
      setFormError(`Enter the ${provider === "zoom" ? "Zoom" : "Google Meet"} meeting link.`);
      return;
    }
    if (quota?.exhausted && mode === "flowzen" && !hasFlowZenRoom) {
      setFormError(
        "You have used all FlowZen video rooms this month. Choose Zoom, Google Meet or an in-person interview."
      );
      return;
    }

    updates.meetingType = mode === "in-person" ? "in-person" : "video";
    if (mode === "in-person") {
      updates.location = location;
    } else {
      updates.location = "";
      updates.videoProvider = mode === "external" ? provider : "flowzen";
      if (mode === "external") {
        updates.meetingLink = meetingLink;
        updates.meetingPassword = meetingPassword;
      }
    }

    const status = String(form.get("status") || "");
    if (status) updates.status = status;
    try {
      await updateInterview(interviewId, updates);
      onIvChange();
      setModal(null);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Failed to update the interview.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-lg neu-card">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
          <h2 className="text-base font-semibold">Update Interview</h2>

          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
            onClick={() => setModal(null)}
            type="button"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <form className="space-y-4 overflow-y-auto p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Reschedule At
            </span>
            <input
              name="scheduledAt"
              type="datetime-local"
              defaultValue={toDatetimeLocal(interview?.scheduledAt)}
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
          <MeetingModeFields
            mode={mode}
            onModeChange={setMode}
            provider={provider}
            onProviderChange={setProvider}
            meetingLink={meetingLink}
            onMeetingLinkChange={setMeetingLink}
            meetingPassword={meetingPassword}
            onMeetingPasswordChange={setMeetingPassword}
            quota={quota}
            locationFields={<InterviewLocationFields jobLocation="" defaultValue={interview?.location || ""} />}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </span>
            <select
              name="status"
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            >
            <option value="">Keep current</option>
            <option value="cancelled">Cancel</option>
            <option value="rescheduled">Rescheduled</option>
          </select>
        </label>
        {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="neu-btn neu-btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >

            {saving ? "Updating…" : "Update"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ViewInterviewModal({
  interviewId,
  candidateInterviews,
  onIvChange,
}: {
  interviewId: string;
  candidateInterviews: any[];
  onIvChange: () => void;
}) {
  const { setModal, updateInterview, saving } = useRecruitmentStore();
  const { data: session } = useSession();
  const isFullAccess =
    session?.user?.role === "admin" || session?.user?.role === "human-resource";
  const [actionError, setActionError] = useState("");
  const [resumeOpen, setResumeOpen] = useState(false);

  const interview = candidateInterviews.find((i) => i.id === interviewId);

  const getJobRef = (iv: any): string => {
    if (iv?.job && typeof iv.job === "object") return String((iv.job as any).id ?? "");
    return String(iv?.job ?? "");
  };
  const getDateRef = (iso: string): string => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const locked = useMemo(() => {
    if (!interview) return false;
    const group = candidateInterviews
      .filter(
        (x) => getJobRef(x) === getJobRef(interview) && getDateRef(x.scheduledAt) === getDateRef(interview.scheduledAt)
      )
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    const idx = group.findIndex((x) => x.id === interviewId);
    for (let i = 0; i < idx; i++) {
      if (group[i].status !== "completed" && group[i].status !== "cancelled") return true;
    }
    return false;
  }, [candidateInterviews, interviewId, interview]);

  const isFrozen = interview?.status === "in-progress";
  const isOnline = !!(interview?.meetingLink && String(interview.meetingLink).trim());
  const isFlowZenRoom = Boolean(interview?.meetingLink && String(interview.meetingLink).includes("/recruitment/interview/"));

  useEffect(() => {
    if (!isFrozen || isOnline) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isFrozen, isOnline]);

  if (!interview) return null;

  const cand = interview.candidate && typeof interview.candidate === "object" ? (interview.candidate as any) : null;
  const candidateName = cand ? `${cand.firstName ?? ""} ${cand.lastName ?? ""}`.trim() : "Unknown";
  const job = interview.job && typeof interview.job === "object" ? (interview.job as any) : null;
  const jobTitle = job?.title || "";
  const interviewer = interview.interviewer && typeof interview.interviewer === "object" ? (interview.interviewer as any).name : "";
  const interviewerRole = interview.interviewer && typeof interview.interviewer === "object" ? (interview.interviewer as any).role : "";
  const createdBy = interview.createdBy && typeof interview.createdBy === "object" ? (interview.createdBy as any) : null;
  const round = (interview.roundType || "").charAt(0).toUpperCase() + (interview.roundType || "").slice(1);
  const statusLabel = interview.status === "in-progress" ? "In Progress" : interview.status.charAt(0).toUpperCase() + interview.status.slice(1);
  const dateTime = new Date(interview.scheduledAt).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const assessmentPct =
    cand && cand.assessmentMaxMarks
      ? `${((cand.assessmentRawMarks ?? 0) / cand.assessmentMaxMarks * 100).toFixed(1)}%`
      : cand?.assessmentScore != null
        ? `${cand.assessmentScore}%`
        : null;

  const handleStart = async () => {
    setActionError("");
    try {
      await updateInterview(interviewId, { status: "in-progress" });
      onIvChange();
    } catch (e: any) {
      setActionError(String(e?.message || "Failed to start interview."));
    }
  };

  const canAction = interview.status === "scheduled" || interview.status === "rescheduled" || interview.status === "in-progress";

  return (
    <>
      <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
        <div className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg neu-card ${isFrozen ? "ring-2 ring-amber-300/60" : ""}`}>
          <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
            <h2 className="text-base font-semibold">Interview Details</h2>
            {!isFrozen && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
                onClick={() => setModal(null)}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </header>

          <div className="flex flex-col gap-5 p-5 md:flex-row">
            {/* Left column */}
            <div className="flex-1 space-y-4 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{candidateName}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize">{round} Round</span>
                </div>
                {jobTitle && <p className="mt-0.5 text-sm text-slate-500">{jobTitle}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--c-border-light)] p-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  {cand?.email ? <a className="text-indigo-600 hover:underline break-all" href={`mailto:${cand.email}`}>{cand.email}</a> : <p className="text-slate-400">—</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  {cand?.phone ? <a className="text-indigo-600 hover:underline" href={`tel:${cand.phone}`}>{cand.phone}</a> : <p className="text-slate-400">—</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Stage</p>
                  <p className="capitalize">{cand?.stage || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusClasses(interview.status)}`}>
                    {statusLabel}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled At</span>
                  <span className="text-slate-900">{dateTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Interviewer</span>
                  <span className="text-slate-900">{interviewer} {interviewerRole ? `· ${interviewerRole}` : ""}</span>
                </div>
                {createdBy && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Scheduled By</span>
                    <span className="text-slate-900">{createdBy.name}{createdBy.companyIdentityCode ? ` · ${createdBy.companyIdentityCode}` : ""}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Meeting</span>
                  {interview.meetingLink ? (
                    <a className="max-w-[60%] truncate text-indigo-600 hover:underline" href={interview.meetingLink} target="_blank" rel="noreferrer">{interview.meetingLink}</a>
                  ) : interview.location ? (
                    <span className="text-slate-900">{interview.location}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>

              {isFlowZenRoom ? (
              <a
                href={interview.meetingLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Video size={17} /> Open FlowZen video room
              </a>
            ) : interview.location ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                This is an in-person interview. No video room was created.
              </div>
            ) : null}

            {/* Scores */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--c-border-light)] p-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">ATS Score</p>
                  {cand?.atsScore != null ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{cand.atsScore}/100</span>
                      <AtsStatusBadge status={cand.atsStatus} terminal={cand.stage === "ats-rejected" || cand.stage === "rejected"} />
                    </div>
                  ) : <p className="mt-1 text-sm text-slate-400">—</p>}
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Assessment Score</p>
                  {cand?.assessmentScore != null ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {cand.assessmentScore}/100
                        {cand.assessmentMaxMarks ? ` · ${cand.assessmentRawMarks ?? 0}/${cand.assessmentMaxMarks}` : ""}
                        {assessmentPct ? ` · ${assessmentPct}` : ""}
                      </span>
                      <ScoreStatusBadge status={cand.assessmentStatus} />
                    </div>
                  ) : <p className="mt-1 text-sm text-slate-400">—</p>}
                </div>
              </div>

              {/* Resume */}
              {cand?.resumeUrl && (
                <button
                  type="button"
                  onClick={() => setResumeOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-xs font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
                >
                  <Download size={14} /> Show Resume
                </button>
              )}
            </div>

            {/* Right column — Job skills & description */}
            {job && (job.requiredSkills?.length > 0 || job.description) && (
              <div className="flex w-full shrink-0 flex-col gap-4 md:h-[calc(90vh-9rem)] md:w-72 md:min-h-0 md:self-start md:border-l md:border-[var(--c-border-light)] md:pl-5">
                {job.requiredSkills?.length > 0 && (
                  <div className="max-h-[250px] overflow-y-auto rounded-lg border border-[var(--c-border-light)] p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider  text-slate-400">Required Skills</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {job.requiredSkills.map((skill: string, i: number) => (
                        <span key={i} className="rounded-full bg-[var(--c-bg-muted)] px-3 py-1 text-[11px] font-medium text-slate-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {job.description && (
                  <div className="max-h-[250px] overflow-y-auto rounded-lg border border-[var(--c-border-light)] p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Description</p>
                    <JobDescription content={job.description} className="mt-1" />
                  </div>
                )}
              </div>
            )}
          </div>

          {interview.status === "completed" && interview.feedback && (
            <div className="mx-5 mb-5 rounded-lg border border-[var(--c-border-light)] p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Feedback</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-slate-100 px-2 py-1">Tech: {interview.feedback.technicalSkills}/5</span>
                <span className="rounded bg-slate-100 px-2 py-1">Comm: {interview.feedback.communication}/5</span>
                <span className="rounded bg-slate-100 px-2 py-1">Problem: {interview.feedback.problemSolving}/5</span>
                <span className="rounded bg-slate-100 px-2 py-1">Culture: {interview.feedback.cultureFit}/5</span>
                <span className={`rounded px-2 py-1 font-medium ${
                  interview.feedback.overallRecommendation === "strong-hire" ? "bg-emerald-50 text-emerald-700" :
                  interview.feedback.overallRecommendation === "hire" ? "bg-sky-50 text-sky-700" :
                  interview.feedback.overallRecommendation === "hold" ? "bg-amber-50 text-amber-700" :
                  "bg-rose-50 text-rose-700"
                }`}>{interview.feedback.overallRecommendation.replace("-", " ")}</span>
              </div>
            </div>
          )}

          {isFrozen && (
            <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Lock size={15} className="shrink-0 text-amber-600" />
              <span>Interview is in progress — this session is locked. {!isOnline && "Do not close this window or navigate away."}</span>
            </div>
          )}

          {actionError && <p className="mx-5 text-sm text-rose-600">{actionError}</p>}

          {canAction && (
            <div className="flex items-center gap-3 border-t border-[var(--c-border-light)] px-5 py-4">
              {isFullAccess && !isFrozen && (
                <button
                  suppressHydrationWarning
                  onClick={() => setModal({ type: "edit-interview", interviewId })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Edit
                </button>
              )}
              {interview.status === "in-progress" ? (
                <button
                  suppressHydrationWarning
                  onClick={() => setModal({ type: "add-feedback", interviewId })}
                  className="flex-1 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Interview Done
                </button>
              ) : locked ? (
                <span className="flex-1 text-sm italic text-slate-400">Waiting for previous candidate to finish</span>
              ) : (
                <button
                  suppressHydrationWarning
                  onClick={handleStart}
                  disabled={saving}
                  className="flex-1 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Starting…" : "Start Interview"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {resumeOpen && cand?.resumeUrl ? (
        <ResumeViewerModal
          url={cand.resumeUrl}
          candidateName={candidateName}
          onClose={() => setResumeOpen(false)}
        />
      ) : null}
    </>
  );
}

function InterviewModals({
  candidateId,
  jobLocation,
  candidateInterviews,
  onIvChange,
}: {
  candidateId: string;
  jobLocation?: string;
  candidateInterviews: any[];
  onIvChange: () => void;
}) {
  const { modal } = useRecruitmentStore();

  if (!modal) return null;
  if (modal.type === "schedule-interview")
    return (
      <ScheduleInterviewModal
        candidateId={candidateId}
        jobLocation={jobLocation}
        onIvChange={onIvChange}
      />
    );
  if (modal.type === "add-feedback")
    return (
      <AddFeedbackModal
        interviewId={modal.interviewId}
        onIvChange={onIvChange}
      />
    );
  if (modal.type === "edit-interview")
    return (
      <EditInterviewModal
        interviewId={modal.interviewId}
        candidateInterviews={candidateInterviews}
        onIvChange={onIvChange}
      />
    );
  return null;
}

export {
  ScheduleInterviewModal,
  AddFeedbackModal,
  EditInterviewModal,
  ViewInterviewModal,
  InterviewModals,
};
