"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { apiFetch } from "@/lib/client-utils";
import { InterviewLocationFields } from "@/components/recruitment/interview-location-fields";

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
  const [meetingType, setMeetingType] = useState("online");

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
    const form = new FormData(e.currentTarget);
    await createInterview({
      candidate: candidateId,
      interviewer: String(form.get("interviewer") || ""),
      roundType: String(form.get("roundType") || "screening") as any,
      scheduledAt: String(form.get("scheduledAt") || ""),
      meetingLink: String(form.get("meetingLink") || ""),
      location: String(form.get("location") || ""),
    });
    onIvChange();
    setModal(null);
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
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Meeting Type
            </span>
            <select
              name="meetingType"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="online">Online (meeting link)</option>
              <option value="in-person">In-person (location)</option>
            </select>
          </label>
          {meetingType === "online" ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Meeting Link
              </span>
              <input
                name="meetingLink"
                placeholder="https://meet.google.com/..."
                className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </label>
          ) : (
            <InterviewLocationFields jobLocation={jobLocation} />
          )}
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
  const [meetingType, setMeetingType] = useState(interview?.meetingLink ? "online" : "in-person");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const form = new FormData(e.currentTarget);
    const updates: Record<string, any> = {};
    const scheduledAt = String(form.get("scheduledAt") || "");
    if (scheduledAt) updates.scheduledAt = scheduledAt;
    const meetingLink = String(form.get("meetingLink") || "");
    if (meetingLink) updates.meetingLink = meetingLink;
    const location = String(form.get("location") || "");
    if (location) updates.location = location;
    const status = String(form.get("status") || "");
    if (status) updates.status = status;
    await updateInterview(interviewId, updates);
    onIvChange();
    setModal(null);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
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
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Reschedule At
            </span>
            <input
              name="scheduledAt"
              type="datetime-local"
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Meeting Type
            </span>
            <select
              name="meetingType"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="online">Online (meeting link)</option>
              <option value="in-person">In-person (location)</option>
            </select>
          </label>
          {meetingType === "online" ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Meeting Link
              </span>
              <input
                name="meetingLink"
                defaultValue={interview?.meetingLink || ""}
                className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </label>
          ) : (
            <InterviewLocationFields jobLocation="" defaultValue={interview?.location || ""} />
          )}
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

  if (!interview) return null;

  const cand = interview.candidate && typeof interview.candidate === "object" ? (interview.candidate as any) : null;
  const candidateName = cand ? `${cand.firstName ?? ""} ${cand.lastName ?? ""}`.trim() : "Unknown";
  const jobTitle = interview.job && typeof interview.job === "object" ? (interview.job as any).title : "";
  const interviewer = interview.interviewer && typeof interview.interviewer === "object" ? (interview.interviewer as any).name : "";
  const interviewerRole = interview.interviewer && typeof interview.interviewer === "object" ? (interview.interviewer as any).role : "";
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
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
          <h2 className="text-base font-semibold">Interview Details</h2>
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
            onClick={() => setModal(null)}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="space-y-4 p-5">
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

          {interview.status === "completed" && interview.feedback && (
            <div className="rounded-lg border border-[var(--c-border-light)] p-3">
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

          {actionError && <p className="text-sm text-rose-600">{actionError}</p>}

          {canAction && (
            <div className="flex items-center gap-3 border-t border-[var(--c-border-light)] pt-4">
              {isFullAccess && (
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
    </div>
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
  if (modal.type === "view-interview")
    return (
      <ViewInterviewModal
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
