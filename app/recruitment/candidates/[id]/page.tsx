"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, FileText, MessageSquare, Send, Star, Upload, UserPlus, Download, Briefcase, CheckCircle, XCircle } from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { STAGE_LABELS, type Stage, STAGES } from "@/lib/recruitment-types";
import { cn } from "@/lib/client-utils";

export default function CandidateProfilePage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const {
    activeCandidate, timeline, interviews, loading,
    fetchCandidate, fetchTimeline, updateCandidate,
    moveCandidateStage, convertToEmployee, uploadResume,
    setModal,
  } = useRecruitmentStore();

  const [activeTab, setActiveTab] = useState<"timeline" | "interviews" | "notes">("timeline");
  const [noteText, setNoteText] = useState("");

  useEffect(() => { void fetchCandidate(id); void fetchTimeline(id); }, [id, fetchCandidate, fetchTimeline]);

  if (loading && !activeCandidate) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
      </div>
    );
  }

  if (!activeCandidate) {
    return <div className="p-6 text-slate-500">Candidate not found.</div>;
  }

  const recruiterName = activeCandidate.assignedRecruiter
    ? typeof activeCandidate.assignedRecruiter === "object"
      ? activeCandidate.assignedRecruiter.name
      : ""
    : "";
  const jobTitle = activeCandidate.job && typeof activeCandidate.job === "object"
    ? (activeCandidate.job as any).title
    : "";

  const timelineIcons: Record<string, any> = {
    applied: UserPlus,
    "resume-uploaded": Upload,
    "interview-scheduled": Calendar,
    "interview-completed": CheckCircle,
    "offer-generated": FileText,
    "offer-accepted": CheckCircle,
    "offer-rejected": XCircle,
    "stage-changed": Send,
    joined: Briefcase,
    rejected: XCircle,
    "note-added": MessageSquare,
  };

  async function handleStageChange(newStage: string) {
    await moveCandidateStage(id, newStage as Stage);
  }

  async function handleConvert() {
    await convertToEmployee(id);
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadResume(id, file);
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    await updateCandidate(id, { notes: activeCandidate!.notes + "\n" + `[${new Date().toLocaleDateString()}] ${noteText}` });
    setNoteText("");
  }

  const currentStageIndex = STAGES.indexOf(activeCandidate.stage);

  return (
    <div className="p-6">
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-lg font-bold text-white">
                {activeCandidate.firstName[0]}{activeCandidate.lastName[0]}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">{activeCandidate.firstName} {activeCandidate.lastName}</h1>
                <p className="text-sm text-slate-500">{activeCandidate.email} {activeCandidate.phone ? `· ${activeCandidate.phone}` : ""}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              {jobTitle && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium">{jobTitle}</span>}
              {recruiterName && <span className="text-xs text-slate-400">Recruiter: {recruiterName}</span>}
              <span className="text-slate-300">|</span>
              <span className="text-xs">{activeCandidate.experienceYears}y exp</span>
              {activeCandidate.currentCompany && <><span className="text-slate-300">|</span><span className="text-xs">{activeCandidate.currentCompany}</span></>}
              <span className="text-slate-300">|</span>
              <span className="text-xs">Notice: {activeCandidate.noticePeriod}d</span>
              <span className="text-slate-300">|</span>
              <span className="text-xs">Source: {activeCandidate.source}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeCandidate.rating > 0 && (
              <span className="text-lg text-amber-500">{'★'.repeat(activeCandidate.rating)}{'☆'.repeat(5 - activeCandidate.rating)}</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => void updateCandidate(id, { rating: star === activeCandidate.rating ? 0 : star })}
              className={cn("p-0.5 transition", star <= activeCandidate.rating ? "text-amber-500" : "text-slate-200 hover:text-amber-300")}
            >
              <Star size={16} fill={star <= activeCandidate.rating ? "currentColor" : "none"} />
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {activeCandidate.resumeUrl && (
            <a
              href={activeCandidate.resumeUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Download size={14} /> Resume
            </a>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Upload size={14} /> Upload Resume
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} />
          </label>
          {activeCandidate.linkedInUrl && (
            <a href={activeCandidate.linkedInUrl} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-50">
              LinkedIn
            </a>
          )}
          {activeCandidate.portfolioUrl && (
            <a href={activeCandidate.portfolioUrl} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Portfolio
            </a>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Stage</p>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
              activeCandidate.stage === "joined" ? "bg-emerald-50 text-emerald-700" :
              activeCandidate.stage === "rejected" ? "bg-rose-50 text-rose-700" :
              "bg-indigo-50 text-indigo-700"
            }`}>{STAGE_LABELS[activeCandidate.stage]}</span>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {STAGES.map((stage, idx) => (
              <div key={stage} className="flex items-center flex-1">
                <button
                  onClick={() => void handleStageChange(stage)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1 text-xs font-medium transition text-center",
                    idx === currentStageIndex ? "bg-slate-950 text-white" :
                    idx < currentStageIndex ? "bg-emerald-50 text-emerald-700" :
                    "bg-slate-100 text-slate-400 hover:bg-slate-200"
                  )}
                >
                  {STAGE_LABELS[stage]}
                </button>
                {idx < STAGES.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setModal({ type: "schedule-interview", candidateId: id })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Calendar size={14} /> Schedule Interview
          </button>
          <button
            onClick={() => setModal({ type: "generate-offer", candidateId: id })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <FileText size={14} /> Generate Offer
          </button>
          {activeCandidate.stage === "joined" && (
            <button
              onClick={handleConvert}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Briefcase size={14} /> Convert To Employee
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex border-b border-slate-200">
          {(["timeline", "interviews", "notes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition",
                activeTab === tab ? "border-slate-950 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "timeline" && (
            <div className="space-y-3">
              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500">No timeline entries yet.</p>
              ) : (
                timeline.map((entry) => {
                  const Icon = timelineIcons[entry.action] || MessageSquare;
                  const actorName = entry.actor && typeof entry.actor === "object" ? (entry.actor as any).name : "System";
                  return (
                    <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3">
                      <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 capitalize">{entry.action.replace(/-/g, " ")}</p>
                        <p className="text-xs text-slate-500">
                          by {actorName} · {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <p className="mt-1 text-xs text-slate-400">{JSON.stringify(entry.metadata)}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "interviews" && (
            <div className="space-y-3">
              {interviews.length === 0 ? (
                <p className="text-sm text-slate-500">No interviews scheduled.</p>
              ) : (
                interviews.map((interview) => {
                  const interviewerName = interview.interviewer && typeof interview.interviewer === "object"
                    ? (interview.interviewer as any).name : "";
                  return (
                    <div key={interview.id} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 capitalize">{interview.roundType} Round</p>
                          <p className="text-xs text-slate-500">
                            {interviewerName && <>Interviewer: {interviewerName} · </>}
                            {new Date(interview.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          interview.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                          interview.status === "cancelled" ? "bg-rose-50 text-rose-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>{interview.status}</span>
                      </div>
                      {interview.meetingLink && (
                        <a href={interview.meetingLink} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs text-sky-600 hover:underline">
                          Join Meeting
                        </a>
                      )}
                      {interview.feedback && interview.feedback.overallRecommendation && interview.status === "completed" && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded bg-slate-100 px-2 py-0.5">Tech: {interview.feedback.technicalSkills}/5</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5">Comm: {interview.feedback.communication}/5</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5">Problem: {interview.feedback.problemSolving}/5</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5">Culture: {interview.feedback.cultureFit}/5</span>
                          <span className={`rounded px-2 py-0.5 font-medium ${
                            interview.feedback.overallRecommendation === "strong-hire" ? "bg-emerald-50 text-emerald-700" :
                            interview.feedback.overallRecommendation === "hire" ? "bg-sky-50 text-sky-700" :
                            interview.feedback.overallRecommendation === "hold" ? "bg-amber-50 text-amber-700" :
                            "bg-rose-50 text-rose-700"
                          }`}>{interview.feedback.overallRecommendation}</span>
                        </div>
                      )}
                      {interview.status === "scheduled" && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => setModal({ type: "add-feedback", interviewId: interview.id })}
                            className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Add Feedback
                          </button>
                          <button
                            onClick={() => setModal({ type: "edit-interview", interviewId: interview.id })}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Reschedule
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div>
              {activeCandidate.notes && (
                <div className="mb-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  {activeCandidate.notes}
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={!noteText.trim()}
                  className="self-end rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <InterviewModals candidateId={id} />
      <OfferModal candidateId={id} />
    </div>
  );
}

function ScheduleInterviewModal({ candidateId }: { candidateId: string }) {
  const { setModal, createInterview } = useRecruitmentStore();

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
    setModal(null);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Schedule Interview</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Round Type</span>
            <select name="roundType" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
              <option value="screening">Screening</option>
              <option value="technical">Technical</option>
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Interviewer ID</span>
            <input name="interviewer" required placeholder="User ID" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Scheduled At</span>
            <input name="scheduledAt" type="datetime-local" required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Meeting Link</span>
            <input name="meetingLink" placeholder="https://meet.google.com/..." className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <button type="submit" className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Schedule</button>
        </form>
      </div>
    </div>
  );
}

function AddFeedbackModal({ interviewId }: { interviewId: string }) {
  const { setModal, addFeedback, interviews } = useRecruitmentStore();
  const interview = interviews.find((i) => i.id === interviewId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await addFeedback(interviewId, {
      technicalSkills: Number(form.get("technicalSkills") || 3),
      communication: Number(form.get("communication") || 3),
      problemSolving: Number(form.get("problemSolving") || 3),
      cultureFit: Number(form.get("cultureFit") || 3),
      overallRecommendation: String(form.get("recommendation") || "hold") as any,
      notes: String(form.get("notes") || ""),
    });
    setModal(null);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Interview Feedback</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            {["technicalSkills", "communication", "problemSolving", "cultureFit"].map((field) => (
              <label key={field} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 capitalize">{field.replace(/([A-Z])/g, " $1")}</span>
                <select name={field} defaultValue="3" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Overall Recommendation</span>
            <select name="recommendation" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
              <option value="strong-hire">Strong Hire</option>
              <option value="hire">Hire</option>
              <option value="hold">Hold</option>
              <option value="reject">Reject</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Notes</span>
            <textarea name="notes" rows={3} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <button type="submit" className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Submit Feedback</button>
        </form>
      </div>
    </div>
  );
}

function EditInterviewModal({ interviewId }: { interviewId: string }) {
  const { setModal, updateInterview, interviews } = useRecruitmentStore();
  const interview = interviews.find((i) => i.id === interviewId);

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
    setModal(null);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Update Interview</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Reschedule At</span>
            <input name="scheduledAt" type="datetime-local" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Meeting Link</span>
            <input name="meetingLink" defaultValue={interview?.meetingLink || ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
            <select name="status" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none">
              <option value="">Keep current</option>
              <option value="cancelled">Cancel</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
          </label>
          <button type="submit" className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Update</button>
        </form>
      </div>
    </div>
  );
}

function InterviewModals({ candidateId }: { candidateId: string }) {
  const { modal } = useRecruitmentStore();

  if (!modal) return null;
  if (modal.type === "schedule-interview") return <ScheduleInterviewModal candidateId={candidateId} />;
  if (modal.type === "add-feedback") return <AddFeedbackModal interviewId={modal.interviewId} />;
  if (modal.type === "edit-interview") return <EditInterviewModal interviewId={modal.interviewId} />;
  return null;
}

function OfferModal({ candidateId }: { candidateId: string }) {
  const { modal, setModal, createOffer } = useRecruitmentStore();
  if (modal?.type !== "generate-offer") return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createOffer({
      candidate: candidateId,
      offeredCTC: Number(form.get("offeredCTC") || 0),
      joiningDate: String(form.get("joiningDate") || ""),
      designation: String(form.get("designation") || ""),
      department: String(form.get("department") || ""),
      status: "draft",
    });
    setModal(null);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Generate Offer</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Offered CTC *</span>
            <input name="offeredCTC" type="number" required min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Designation *</span>
            <input name="designation" required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Department</span>
            <input name="department" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Joining Date</span>
            <input name="joiningDate" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <button type="submit" className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Generate Offer</button>
        </form>
      </div>
    </div>
  );
}
