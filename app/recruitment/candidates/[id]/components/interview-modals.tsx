"use client";

import { useRecruitmentStore } from "@/store/recruitment-store";

function ScheduleInterviewModal({
  candidateId,
  assignedTeam,
  onIvChange,
}: {
  candidateId: string;
  assignedTeam: any[];
  onIvChange: () => void;
}) {
  const { setModal, createInterview } = useRecruitmentStore();

  const assignedOptions = assignedTeam.filter((a: any) => {
    const uid = a.user?.id || a.user?._id;
    return uid && a.status !== "completed";
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Schedule Interview</h2>
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
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
              <input
                name="interviewer"
                required
                placeholder="User ID"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
            {assignedOptions.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No assigned interviewers. Assign one first or type a User ID
                above.
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Meeting Link
            </span>
            <input
              name="meetingLink"
              placeholder="https://meet.google.com/..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Schedule
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
  const { setModal, addFeedback } = useRecruitmentStore();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Interview Feedback</h2>
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
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
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Submit Feedback
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
  const { setModal, updateInterview } = useRecruitmentStore();
  const interview = candidateInterviews.find((i) => i.id === interviewId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Update Interview</h2>
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Meeting Link
            </span>
            <input
              name="meetingLink"
              defaultValue={interview?.meetingLink || ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </span>
            <select
              name="status"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Keep current</option>
              <option value="cancelled">Cancel</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Update
          </button>
        </form>
      </div>
    </div>
  );
}

function InterviewModals({
  candidateId,
  assignedTeam,
  candidateInterviews,
  onIvChange,
}: {
  candidateId: string;
  assignedTeam: any[];
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
