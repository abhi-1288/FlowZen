"use client";

import { useEffect, useState } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { apiFetch } from "@/lib/client-utils";

function ScheduleInterviewModal({
  candidateId,
  assignedTeam,
  jobLocation,
  onIvChange,
}: {
  candidateId: string;
  assignedTeam: any[];
  jobLocation?: string;
  onIvChange: () => void;
}) {
  const { setModal, createInterview, saving } = useRecruitmentStore();
  const [pickerRole, setPickerRole] = useState("human-resource");
  const [pickerUsers, setPickerUsers] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const assignedOptions = assignedTeam.filter((a: any) => {
    const uid = a.user?.id || a.user?._id;
    return uid && a.status !== "completed";
  });

  const isRemoteJob = !!jobLocation && /^remote$/i.test(jobLocation.trim());

  useEffect(() => {
    if (assignedOptions.length > 0) return;
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
  }, [assignedOptions.length, pickerRole, isRemoteJob]);

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
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Interviewer
            </span>
            {assignedOptions.length > 0 ? (
              <select
                name="interviewer"
                required
                className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="">Select an interviewer...</option>
                {assignedOptions.map((a: any) => {
                  const uid = a.user?.id || a.user?._id;
                  return (
                    <option key={uid} value={uid}>
                      {a.user.name} ({a.role} — {a.roundType})
                    </option>
                  );
                })}
              </select>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-500">Role</span>
                    <select
                      value={pickerRole}
                      onChange={(e) => setPickerRole(e.target.value)}
                      className="neu-inset rounded-lg px-3 py-2.5 text-sm"
                    >
                      <option value="project-manager">Project Manager</option>
                      <option value="qa-tester">QA Tester</option>
                      <option value="finance">Finance</option>
                      <option value="human-resource">HR</option>
                      <option value="admin">Admin</option>
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
                <p className="mt-1 text-xs text-amber-600">
                  No interviewer assigned yet
                  {isRemoteJob
                    ? " — job is remote, open to anyone"
                    : jobLocation
                      ? ` for region "${jobLocation}"`
                      : ""}{" "}
                  — pick one above.
                </p>
              </>
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
              Meeting Link
            </span>
            <input
              name="meetingLink"
              placeholder="https://meet.google.com/..."
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const form = new FormData(e.currentTarget);
    const updates: Record<string, any> = {};
    const scheduledAt = String(form.get("scheduledAt") || "");
    if (scheduledAt) updates.scheduledAt = scheduledAt;
    const meetingLink = String(form.get("meetingLink") || "");
    if (meetingLink) updates.meetingLink = meetingLink;
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
              Meeting Link
            </span>
            <input
              name="meetingLink"
              defaultValue={interview?.meetingLink || ""}
              className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
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

function InterviewModals({
  candidateId,
  assignedTeam,
  jobLocation,
  candidateInterviews,
  onIvChange,
}: {
  candidateId: string;
  assignedTeam: any[];
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
        assignedTeam={assignedTeam}
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
  InterviewModals,
};
