"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  FileText,
  MessageSquare,
  Send,
  Star,
  Upload,
  UserPlus,
  Download,
  Briefcase,
  CheckCircle,
  XCircle,
  ChevronDown,
  Trash2,
  UserCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { useShallow } from "zustand/react/shallow";
import {
  STAGE_LABELS,
  CURRENCY_SYMBOLS,
  type Stage,
  STAGES,
  type ATSCandidate,
  type ATSJob,
} from "@/lib/recruitment-types";
import { cn, apiFetch } from "@/lib/client-utils";
import { useSession } from "next-auth/react";

export default function CandidateProfilePage() {
  const params = useParams()!;
  const id = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isHr = role === "admin" || role === "human-resource";
  const mountedRef = useRef(true);

  const {
    activeCandidate,
    timeline,
    loading,
    fetchCandidate,
    fetchTimeline,
    updateCandidate,
    moveCandidateStage,
    convertToEmployee,
    uploadResume,
    setModal,
  } = useRecruitmentStore(
    useShallow((s) => ({
      activeCandidate: s.activeCandidate,
      timeline: s.timeline,
      loading: s.loading,
      fetchCandidate: s.fetchCandidate,
      fetchTimeline: s.fetchTimeline,
      updateCandidate: s.updateCandidate,
      moveCandidateStage: s.moveCandidateStage,
      convertToEmployee: s.convertToEmployee,
      uploadResume: s.uploadResume,
      setModal: s.setModal,
    }))
  );

  const [activeTab, setActiveTab] = useState<
    "timeline" | "interviews" | "notes"
  >("timeline");
  const [noteText, setNoteText] = useState("");
  const [candidateList, setCandidateList] = useState<any[]>([]);
  const [assignRole, setAssignRole] = useState("project-manager");
  const [assignRoundType, setAssignRoundType] = useState("technical");
  const [assignUsers, setAssignUsers] = useState<any[]>([]);
  const [assignSelectedUser, setAssignSelectedUser] = useState("");
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [stageFeedback, setStageFeedback] = useState("suitable");
  const [submitting, setSubmitting] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertPassword, setConvertPassword] = useState("");
  const [convertConfirmPassword, setConvertConfirmPassword] = useState("");
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const jobId =
    activeCandidate && typeof activeCandidate.job === "object"
      ? (activeCandidate.job as any).id
      : null;

  useEffect(() => {
    void fetchCandidate(id);
    void fetchTimeline(id);
  }, [id, fetchCandidate, fetchTimeline]);

  const [candidateInterviews, setCandidateInterviews] = useState<any[]>([]);
  const [ivRefreshKey, setIvRefreshKey] = useState(0);

  useEffect(() => {
    apiFetch<{ interviews: any[] }>(
      `/api/recruitment/candidates/${id}/interviews`,
    )
      .then((res) => { if (mountedRef.current) setCandidateInterviews(res.interviews || []); })
      .catch(() => {});
  }, [id, ivRefreshKey]);

  const fetchSameJobCandidates = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await apiFetch<{ candidates: any[] }>(
        `/api/recruitment/candidates?jobId=${jobId}`,
      );
      setCandidateList(res.candidates || []);
    } catch {}
  }, [jobId]);

  useEffect(() => {
    void fetchSameJobCandidates();
  }, [fetchSameJobCandidates]);

  const fetchUsersByRole = useCallback(async (r: string) => {
    try {
      const res = await apiFetch<{ users: any[] }>(
        `/api/recruitment/users-by-role?role=${r}`,
      );
      setAssignUsers(res.users || []);
      setAssignSelectedUser(res.users?.[0]?.id || "");
    } catch {}
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (showAssignForm) void fetchUsersByRole(assignRole);
  }, [showAssignForm, assignRole, fetchUsersByRole]);

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
  const jobTitle =
    activeCandidate.job && typeof activeCandidate.job === "object"
      ? (activeCandidate.job as any).title
      : "";

  const timelineLabels: Record<string, string> = {
    applied: "Application Submitted",
    "resume-uploaded": "Resume Uploaded",
    "interview-scheduled": "Interview Scheduled",
    "interview-completed": "Interview Completed",
    "offer-generated": "Offer Generated",
    "offer-accepted": "Offer Accepted",
    "offer-rejected": "Offer Rejected",
    "stage-changed": "Stage Updated",
    joined: "Joined",
    rejected: "Not Selected",
    "note-added": "Note Added",
  };

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
    setShowConvertModal(true);
  }

  async function handleConvertSubmit() {
    if (convertPassword.length < 6) return;
    if (convertPassword !== convertConfirmPassword) return;
    setConvertSubmitting(true);
    try {
      await convertToEmployee(id, convertPassword);
      setShowConvertModal(false);
      setConvertPassword("");
      setConvertConfirmPassword("");
    } finally {
      setConvertSubmitting(false);
    }
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadResume(id, file);
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    await updateCandidate(id, {
      notes:
        activeCandidate!.notes +
        "\n" +
        `[${new Date().toLocaleDateString()}] ${noteText}`,
    });
    setNoteText("");
  }

  async function handleAssign() {
    if (!assignSelectedUser) return;
    try {
      await apiFetch(`/api/recruitment/candidates/${id}/assign-interviewer`, {
        method: "POST",
        body: JSON.stringify({
          role: assignRole,
          roundType: assignRoundType,
          assigneeId: assignSelectedUser,
        }),
      });
      setShowAssignForm(false);
      void fetchCandidate(id);
    } catch (e) {
      console.error("Assign failed:", e);
    }
  }

  async function handleRemoveAssignment(roleToRemove: string) {
    try {
      await apiFetch(`/api/recruitment/candidates/${id}/assign-interviewer`, {
        method: "DELETE",
        body: JSON.stringify({ role: roleToRemove }),
      });
      void fetchCandidate(id);
    } catch (e) {
      console.error("Remove failed:", e);
    }
  }

  async function handleStageDone() {
    setSubmitting(true);
    try {
      await apiFetch(`/api/recruitment/candidates/${id}/stage-change-request`, {
        method: "POST",
        body: JSON.stringify({ feedback: stageFeedback }),
      });
      void fetchCandidate(id);
    } catch (e) {
      console.error("Stage request failed:", e);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCandidateSwitch(candidateId: string) {
    router.push(`/recruitment/candidates/${candidateId}`);
  }

  const assignedTeam: Array<{
    role: string;
    user: any;
    roundType: string;
    status: string;
    feedback: string;
  }> = (activeCandidate as any).assignedTeam || [];
  const myAssignment = assignedTeam.find(
    (a: any) => String(a.user?.id || a.user) === String(session?.user?.id),
  );
  const stageRequest = (activeCandidate as any).stageChangeRequest || {};
  const currentStageIndex = STAGES.indexOf(activeCandidate.stage);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back
        </button>
        {candidateList.length > 1 && (
          <div className="relative">
            <select
              value={id}
              onChange={(e) => handleCandidateSwitch(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {candidateList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.id.slice(-6)})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-lg font-bold text-white">
                {activeCandidate.firstName[0]}
                {activeCandidate.lastName[0]}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  {activeCandidate.firstName} {activeCandidate.lastName}
                </h1>
                <p className="text-sm text-slate-500">
                  {activeCandidate.email}{" "}
                  {activeCandidate.phone ? `· ${activeCandidate.phone}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              {jobTitle && (
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium">
                  {jobTitle}
                </span>
              )}
              {recruiterName && (
                <span className="text-xs text-slate-400">
                  Recruiter: {recruiterName}
                </span>
              )}
              <span className="text-slate-300">|</span>
              <span className="text-xs">
                {activeCandidate.experienceYears}y exp
              </span>
              {activeCandidate.currentCompany && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-xs">
                    {activeCandidate.currentCompany}
                  </span>
                </>
              )}
              <span className="text-slate-300">|</span>
              <span className="text-xs">
                Notice: {activeCandidate.noticePeriod}d
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs">Source: {activeCandidate.source}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col justify-center items-center gap-2">
              {activeCandidate.rating > 0 && (
                <span className="text-lg justify-center text-amber-500">
                  {"★".repeat(activeCandidate.rating)}
                  {"☆".repeat(5 - activeCandidate.rating)}
                </span>
              )}

              {activeCandidate &&
                activeCandidate.job &&
                typeof activeCandidate.job === "object" &&
                ((activeCandidate.job as any)._id ||
                  (activeCandidate.job as any).id) && (
                  <button
                    onClick={() =>
                      setModal({
                        type: "view-job-description",
                        jobId:
                          (activeCandidate.job as any)._id ||
                          (activeCandidate.job as any).id,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Briefcase size={14} /> Job Description
                  </button>
                )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() =>
                void updateCandidate(id, {
                  rating: star === activeCandidate.rating ? 0 : star,
                })
              }
              className={cn(
                "p-0.5 transition",
                star <= activeCandidate.rating
                  ? "text-amber-500"
                  : "text-slate-200 hover:text-amber-300",
              )}
            >
              <Star
                size={16}
                fill={star <= activeCandidate.rating ? "currentColor" : "none"}
              />
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
          <div className="flex flex-col gap-1">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Upload size={14} /> Upload Resume
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={handleResumeUpload}
              />
            </label>
            <p className="text-[10px] text-slate-400">Max file size: 2 MB</p>
          </div>
          {(activeCandidate as any).linkedInUrl && (
            <a
              href={(activeCandidate as any).linkedInUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-50"
            >
              LinkedIn
            </a>
          )}
          {(activeCandidate as any).portfolioUrl && (
            <a
              href={(activeCandidate as any).portfolioUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Portfolio
            </a>
          )}
        </div>

        {/* Assigned Team */}
        {assignedTeam.length > 0 && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Assigned Interviewers
            </p>
            <div className="space-y-1.5">
              {assignedTeam.map((a: any) => (
                <div
                  key={a.role}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium capitalize">
                      {a.role}
                    </span>
                    <span className="text-slate-500">{a.roundType}</span>
                    {a.user?.name ? (
                      <span className="text-slate-700">{a.user.name}</span>
                    ) : (
                      <span className="text-amber-600">Unassigned</span>
                    )}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        a.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : a.status === "in-progress"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {a.status}
                    </span>
                    {a.feedback && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          a.feedback === "suitable"
                            ? "bg-emerald-50 text-emerald-700"
                            : a.feedback === "not-suitable"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {a.feedback}
                      </span>
                    )}
                  </div>
                  {isHr && (
                    <button
                      onClick={() => handleRemoveAssignment(a.role)}
                      className="text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Stage
            </p>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                activeCandidate.stage === "joined"
                  ? "bg-emerald-50 text-emerald-700"
                  : activeCandidate.stage === "rejected"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-indigo-50 text-indigo-700"
              }`}
            >
              {STAGE_LABELS[activeCandidate.stage]}
            </span>
          </div>
          {isHr && (
            <div className="mt-2 flex items-center gap-1">
              {STAGES.map((stage, idx) => (
                <div key={stage} className="flex items-center flex-1">
                  <button
                    onClick={() => void handleStageChange(stage)}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1 text-xs font-medium transition text-center",
                      idx === currentStageIndex
                        ? "bg-slate-950 text-white"
                        : idx < currentStageIndex
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                    )}
                  >
                    {STAGE_LABELS[stage]}
                  </button>
                  {idx < STAGES.length - 1 && (
                    <div className="h-px flex-1 bg-slate-200" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {isHr && (
            <>
              <button
                onClick={() =>
                  setModal({ type: "schedule-interview", candidateId: id })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                <Calendar size={14} /> Schedule Interview
              </button>
              <button
                onClick={() =>
                  setModal({ type: "generate-offer", candidateId: id })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <FileText size={14} /> Generate Offer
              </button>
              <button
                onClick={() => setShowAssignForm(!showAssignForm)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <UserPlus size={14} /> Assign Interviewer
              </button>
              {activeCandidate.stage === "joined" && (
                <button
                  onClick={() => setShowConvertModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <Briefcase size={14} /> Convert To Employee
                </button>
              )}
              {activeCandidate.stage === "rejected" && (
                <button
                  onClick={async () => {
                    if (
                      confirm(
                        "Delete this candidate's account? This cannot be undone.",
                      )
                    ) {
                      const { deleteCandidate } =
                        useRecruitmentStore.getState();
                      await deleteCandidate(id);
                      router.push("/recruitment/candidates");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  <XCircle size={14} /> Delete Account
                </button>
              )}
            </>
          )}

          {/* Stage change request for assigned non-HR */}
          {!isHr && myAssignment && myAssignment.status !== "completed" && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-amber-50 p-2">
              <span className="text-xs font-medium text-amber-700">
                Complete your round:
              </span>
              <select
                value={stageFeedback}
                onChange={(e) => setStageFeedback(e.target.value)}
                className="rounded border border-amber-200 bg-white px-2 py-1 text-xs outline-none"
              >
                <option value="suitable">Suitable</option>
                <option value="not-suitable">Not Suitable</option>
                <option value="on-hold">On Hold</option>
              </select>
              <button
                onClick={handleStageDone}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <UserCheck size={14} />{" "}
                {submitting ? "Submitting..." : "Mark Done"}
              </button>
            </div>
          )}
        </div>

        {/* Assign Interviewer Form */}
        {showAssignForm && isHr && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Assign Interviewer
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Role</span>
                <select
                  value={assignRole}
                  onChange={(e) => {
                    setAssignRole(e.target.value);
                    void fetchUsersByRole(e.target.value);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                >
                  <option value="project-manager">Project Manager</option>
                  <option value="qa-tester">QA Tester</option>
                  <option value="finance">Finance</option>
                  <option value="human-resource">HR</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">
                  Round Type
                </span>
                <select
                  value={assignRoundType}
                  onChange={(e) => setAssignRoundType(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                >
                  <option value="screening">Screening</option>
                  <option value="technical">Technical</option>
                  <option value="manager">Manager</option>
                  <option value="hr">HR</option>
                </select>
              </label>
              <label className="block min-w-[180px]">
                <span className="mb-1 block text-xs text-slate-500">User</span>
                <select
                  value={assignSelectedUser}
                  onChange={(e) => setAssignSelectedUser(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                >
                  {assignUsers.length === 0 && (
                    <option value="">No users found</option>
                  )}
                  {assignUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleAssign}
                className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Assign
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex border-b border-slate-200">
          {(["timeline", "interviews", "notes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition",
                activeTab === tab
                  ? "border-slate-950 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700",
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
                <p className="text-sm text-slate-500">
                  No timeline entries yet.
                </p>
              ) : (
                timeline.map((entry) => {
                  const Icon = timelineIcons[entry.action] || MessageSquare;
                  const actorName =
                    entry.actor && typeof entry.actor === "object"
                      ? (entry.actor as any).name
                      : "System";
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3"
                    >
                      <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {timelineLabels[entry.action] ||
                            entry.action.replace(/-/g, " ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          by {actorName} ·{" "}
                          {new Date(entry.createdAt).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                        {entry.metadata &&
                          Object.keys(entry.metadata).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                              {Object.entries(entry.metadata).map(
                                ([key, val]) => {
                                  const label = key
                                    .replace(/([A-Z])/g, " $1")
                                    .replace(/^./, (s) => s.toUpperCase());
                                  return (
                                    <span
                                      key={key}
                                      className="inline-flex items-center gap-1"
                                    >
                                      <span className="font-medium text-slate-500">
                                        {label}:
                                      </span>
                                      <span>{String(val)}</span>
                                    </span>
                                  );
                                },
                              )}
                            </div>
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
              {candidateInterviews.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No interviews scheduled.
                </p>
              ) : (
                candidateInterviews.map((interview) => {
                  const interviewerName =
                    interview.interviewer &&
                    typeof interview.interviewer === "object"
                      ? (interview.interviewer as any).name
                      : "";
                  return (
                    <div
                      key={interview.id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 capitalize">
                            {interview.roundType} Round
                          </p>
                          <p className="text-xs text-slate-500">
                            {interviewerName && (
                              <>Interviewer: {interviewerName} · </>
                            )}
                            {new Date(interview.scheduledAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            interview.status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : interview.status === "cancelled"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {interview.status}
                        </span>
                      </div>
                      {interview.meetingLink && (
                        <a
                          href={interview.meetingLink}
                          target="_blank"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-sky-600 hover:underline"
                        >
                          Join Meeting
                        </a>
                      )}
                      {interview.feedback &&
                        interview.feedback.overallRecommendation &&
                        interview.status === "completed" && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded bg-slate-100 px-2 py-0.5">
                              Tech: {interview.feedback.technicalSkills}/5
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5">
                              Comm: {interview.feedback.communication}/5
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5">
                              Problem: {interview.feedback.problemSolving}/5
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5">
                              Culture: {interview.feedback.cultureFit}/5
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 font-medium ${
                                interview.feedback.overallRecommendation ===
                                "strong-hire"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : interview.feedback.overallRecommendation ===
                                      "hire"
                                    ? "bg-sky-50 text-sky-700"
                                    : interview.feedback
                                          .overallRecommendation === "hold"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {interview.feedback.overallRecommendation}
                            </span>
                          </div>
                        )}
                      {interview.status === "scheduled" && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() =>
                              setModal({
                                type: "add-feedback",
                                interviewId: interview.id,
                              })
                            }
                            className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Add Feedback
                          </button>
                          <button
                            onClick={() =>
                              setModal({
                                type: "edit-interview",
                                interviewId: interview.id,
                              })
                            }
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

      <InterviewModals
        candidateId={id}
        assignedTeam={assignedTeam}
        candidateInterviews={candidateInterviews}
        onIvChange={() => setIvRefreshKey((k) => k + 1)}
      />
      <OfferModal candidateId={id} jobId={jobId} />
      <JobDescriptionModal />
      {showConvertModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold">Convert To Employee</h2>
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                onClick={() => {
                  setShowConvertModal(false);
                  setConvertPassword("");
                  setConvertConfirmPassword("");
                }}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </header>
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void handleConvertSubmit();
              }}
            >
              <p className="text-sm text-slate-500">
                Set a password for {activeCandidate.firstName} {activeCandidate.lastName}. A welcome email with login credentials will be sent to {activeCandidate.email}.
              </p>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={convertPassword}
                    onChange={(e) => setConvertPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={convertConfirmPassword}
                    onChange={(e) => setConvertConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {convertConfirmPassword && convertPassword !== convertConfirmPassword && (
                <p className="text-xs text-rose-500">Passwords do not match.</p>
              )}
              <button
                type="submit"
                disabled={convertSubmitting || convertPassword.length < 6 || convertPassword !== convertConfirmPassword}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {convertSubmitting ? "Converting..." : "Convert & Send Welcome Email"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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
  candidateInterviews,
  onIvChange,
}: {
  interviewId: string;
  candidateInterviews: any[];
  onIvChange: () => void;
}) {
  const { setModal, addFeedback } = useRecruitmentStore();
  const interview = candidateInterviews.find((i) => i.id === interviewId);

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
        candidateInterviews={candidateInterviews}
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

function OfferModal({
  candidateId,
  jobId,
}: {
  candidateId: string;
  jobId: string | null;
}) {
  const router = useRouter();
  const { modal, setModal, createOffer, saving, activeJob, fetchJob } =
    useRecruitmentStore();
  const [loadingJob, setLoadingJob] = useState(false);
  const [offeredCTC, setOfferedCTC] = useState("");

  useEffect(() => {
    if (modal?.type !== "generate-offer" || !jobId) return;
    let cancelled = false;
    setLoadingJob(true);
    (async () => {
      try {
        await fetchJob(jobId);
      } catch {
        // fallback to empty form
      } finally {
        if (!cancelled) setLoadingJob(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modal?.type, jobId, fetchJob]);

  const job = activeJob;
  const salaryType = job?.salaryType === "per-month" ? "per-month" : "per-annum";
  const salaryLabel = salaryType === "per-month" ? "per month" : "per annum";
  const currencySymbol = CURRENCY_SYMBOLS[job?.currency ?? "INR"] ?? "₹";
  const salaryMin = Math.max(0, Number(job?.salaryRangeMin || 0));
  const salaryMax = Math.max(salaryMin, Number(job?.salaryRangeMax || 0));
  const hasSalaryRange = salaryMax > salaryMin;
  const sliderStep = salaryMax - salaryMin > 100000 ? 10000 : 1000;
  const selectedCTC = Number(offeredCTC || salaryMax || salaryMin || 0);

  useEffect(() => {
    if (modal?.type !== "generate-offer") return;
    if (!job) {
      setOfferedCTC("");
      return;
    }
    const defaultAmount = Number(job.salaryRangeMax || job.salaryRangeMin || 0);
    setOfferedCTC(defaultAmount > 0 ? String(defaultAmount) : "");
  }, [modal?.type, job?.id, job?.salaryRangeMin, job?.salaryRangeMax]);

  if (modal?.type !== "generate-offer") return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createOffer({
      candidate: candidateId,
      offeredCTC: selectedCTC,
      salaryType,
      pfAmount: Number(form.get("pfAmount") || 0),
      esicAmount: Number(form.get("esicAmount") || 0),
      joiningDate: String(form.get("joiningDate") || ""),
      designation: String(form.get("designation") || ""),
      department: String(form.get("department") || ""),
      officeLocation: String(form.get("officeLocation") || ""),
      perks: String(form.get("perks") || ""),
      status: "draft",
    });
    setModal(null);
    router.push(`/recruitment/offer/jobs/${candidateId}`);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/35">
      <div className="flex min-h-full items-start justify-center p-4 pt-12">
        <div className="w-full max-w-lg rounded-lg bg-white shadow-soft">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold">Generate Offer</h2>
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
          {loadingJob ? (
            <div className="p-5 text-center text-sm text-slate-500">
              Loading job details...
            </div>
          ) : (
            <form className="p-5" onSubmit={handleSubmit} key={job?.id === jobId ? `loaded-${jobId}` : "empty"}>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Offered CTC * ({salaryLabel})
                  </span>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold text-slate-950">
                        {currencySymbol}
                        {selectedCTC.toLocaleString("en-IN")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Auto selected from job salary type: {salaryLabel}
                      </p>
                    </div>
                    {job && (
                      <p className="text-right text-xs text-slate-500">
                        Job range<br />
                        {currencySymbol}
                        {salaryMin.toLocaleString("en-IN")} - {currencySymbol}
                        {salaryMax.toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                  <input name="offeredCTC" type="hidden" value={selectedCTC || ""} />
                  <input name="salaryType" type="hidden" value={salaryType} />
                  <input
                    type="range"
                    required
                    min={hasSalaryRange ? salaryMin : 0}
                    max={hasSalaryRange ? salaryMax : Math.max(salaryMax, selectedCTC, 100000)}
                    step={sliderStep}
                    value={selectedCTC}
                    onChange={(e) => setOfferedCTC(e.target.value)}
                    className="mt-4 w-full accent-slate-950"
                    disabled={!job || salaryMax <= 0}
                  />
                  <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-400">
                    <span>
                      {currencySymbol}
                      {(hasSalaryRange ? salaryMin : 0).toLocaleString("en-IN")}
                    </span>
                    <span>
                      {currencySymbol}
                      {(hasSalaryRange ? salaryMax : Math.max(salaryMax, selectedCTC, 100000)).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Designation *
                  </span>
                  <input
                    name="designation"
                    required
                    defaultValue={job?.title || ""}
                    readOnly={Boolean(job?.title)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 read-only:bg-slate-50 read-only:text-slate-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Department
                  </span>
                  <input
                    name="department"
                    defaultValue={job?.department || ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    PF Amount (per year)
                  </span>
                  <input
                    name="pfAmount"
                    type="number"
                    min="0"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    ESIC Amount (per year)
                  </span>
                  <input
                    name="esicAmount"
                    type="number"
                    min="0"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Joining Date
                  </span>
                  <input
                    name="joiningDate"
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Office Location
                  </span>
                  <input
                    name="officeLocation"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Bangalore, India"
                  />
                </label>
                <label className="block col-span-full">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Travel &amp; Food Accommodation
                  </span>
                  <textarea
                    name="perks"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Company provides travel allowance and complimentary meals."
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-4 w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Generating..." : "Generate Offer"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function JobDescriptionModal() {
  const { modal, setModal, fetchJob, activeJob } = useRecruitmentStore();
  const isOpen = modal?.type === "view-job-description";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen || !modal || modal.type !== "view-job-description") return;
    setLoading(true);
    setError(false);
    fetchJob(modal.jobId)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isOpen, modal, fetchJob]);

  const job = isOpen ? activeJob : null;

  if (!isOpen) return null;

  const currencySymbol = CURRENCY_SYMBOLS[job?.currency ?? "INR"] ?? "₹";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/35">
      <div className="flex min-h-full items-start justify-center p-4 pt-12">
        <div className="w-full max-w-lg rounded-lg bg-white shadow-soft">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold">Job Description</h2>
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
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : error ? (
              <p className="text-sm text-rose-500">
                Failed to load job details.
              </p>
            ) : !job ? null : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {job.title}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {job.department} &middot; {job.location} &middot;{" "}
                    {job.employmentType}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Salary Range
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {currencySymbol}
                    {Number(job.salaryRangeMin).toLocaleString()} -{" "}
                    {currencySymbol}
                    {Number(job.salaryRangeMax).toLocaleString()}
                  </p>
                </div>

                {job.requiredSkills.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                      Required Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.requiredSkills.map((skill, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {job.description && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                      Description
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {job.description}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  {job.openings > 0 && (
                    <span>
                      {job.openings} opening{job.openings > 1 ? "s" : ""}
                    </span>
                  )}
                  <span
                    className={
                      job.status === "open"
                        ? "text-emerald-600"
                        : job.status === "closed"
                          ? "text-rose-600"
                          : "text-amber-600"
                    }
                  >
                    {job.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
