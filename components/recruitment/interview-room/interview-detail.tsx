"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { interviewSlug } from "@/lib/interview-slug";
import { getInterviewJoinOpensAt, formatInterviewCountdown, isInterviewJoinable } from "@/lib/interview-timing";
import { isExternalVideoProvider, videoProviderLabel } from "@/lib/interview-provider";
import { AddFeedbackModal, EditInterviewModal } from "@/app/recruitment/candidates/[id]/components/interview-modals";
import { JobDescription } from "@/components/recruitment/job-description";
import { InterviewRoom, type RoomCredentials } from "@/components/recruitment/interview-room/interview-room";
import { InterviewDock } from "@/components/recruitment/interview-room/interview-dock";
import { MediaDevicesProvider, useMediaDevices } from "@/components/recruitment/interview-room/media-devices";
import { DeviceCheckPanel } from "@/components/recruitment/interview-room/device-check-panel";
import { ResumeViewerModal } from "@/components/recruitment/resume-viewer-modal";

type InterviewDetail = {
  id: string;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    stage?: string;
    resumeUrl?: string;
    atsScore?: number | null;
    atsStatus?: string;
    assessmentScore?: number | null;
    assessmentStatus?: string;
    assessmentRawMarks?: number | null;
    assessmentMaxMarks?: number | null;
  } | null;
  job: {
    id: string;
    title: string;
    requiredSkills?: string[];
    description?: string;
  } | null;
  interviewer: { id: string; name: string; email?: string } | null;
  roundType: string;
  scheduledAt: string;
  meetingType?: "video" | "in-person";
  videoProvider?: "flowzen" | "zoom" | "google-meet";
  meetingLink?: string;
  meetingPassword?: string;
  location?: string;
  status: string;
  feedback?: {
    technicalSkills: number;
    communication: number;
    problemSolving: number;
    cultureFit: number;
    overallRecommendation: string;
    notes?: string;
  } | null;
  createdBy?: { id: string; name: string; companyIdentityCode?: string } | null;
  canManage?: boolean;
  isAssignedInterviewer?: boolean;
};

function statusClasses(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  if (status === "cancelled") return "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
  if (status === "in-progress") return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
  if (status === "rescheduled") return "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300";
  return "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-app p-4 text-base sm:p-6">
      <div className="mx-auto max-w-6xl animate-pulse space-y-5">
        <div className="h-10 w-36 rounded-xl bg-[var(--c-skeleton)]" />
        <div className="h-52 rounded-2xl bg-[var(--c-skeleton)]" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-80 rounded-2xl bg-[var(--c-skeleton)] lg:col-span-2" />
          <div className="h-80 rounded-2xl bg-[var(--c-skeleton)]" />
        </div>
      </div>
    </div>
  );
}

/**
 * The provider wraps both the pre-join device check and the call itself, so a
 * camera chosen (and permitted) on the join screen is the same one the call uses
 * and joining never re-prompts.
 */
export function InterviewDetailPage(props: {
  jobSlug: string;
  candidateSlug: string;
  interviewId?: string;
  access?: string;
}) {
  return (
    <MediaDevicesProvider>
      <InterviewDetailScreen {...props} />
    </MediaDevicesProvider>
  );
}

function InterviewDetailScreen({
  jobSlug,
  candidateSlug,
  interviewId,
  access,
}: {
  jobSlug: string;
  candidateSlug: string;
  interviewId?: string;
  access?: string;
}) {
  const router = useRouter();
  const media = useMediaDevices();
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [joining, setJoining] = useState(false);
  const [credentials, setCredentials] = useState<RoomCredentials | null>(null);
  // Split by severity: a failed join is an error, while "call ended" and "the
  // interviewer ended the call" are ordinary status and must not read as one.
  const [callError, setCallError] = useState("");
  const [callMessage, setCallMessage] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const candidateMode = !interviewId;

  const loadDetail = useCallback(
    async (opts?: { quiet?: boolean }) => {
      // A background poll must not be able to replace a live call with the
      // "Interview unavailable" screen, so it leaves error/loading untouched and
      // only pushes fresh data.
      if (!opts?.quiet) setError("");
      try {
        const response = interviewId
          ? await apiFetch<{ interview: InterviewDetail }>(`/api/recruitment/interviews/${encodeURIComponent(interviewId)}`, undefined, { toast: false })
          : await apiFetch<{ interview: InterviewDetail }>(
              `/api/public/interview-room?job=${encodeURIComponent(jobSlug)}&candidate=${encodeURIComponent(candidateSlug)}&access=${encodeURIComponent(access ?? "")}`,
              undefined,
              { toast: false }
            );
        const resolvedJobSlug = interviewSlug(response.interview.job?.title ?? "");
        const resolvedCandidateSlug = interviewSlug(`${response.interview.candidate?.firstName ?? ""} ${response.interview.candidate?.lastName ?? ""}`.trim());
        if (resolvedJobSlug !== jobSlug || resolvedCandidateSlug !== candidateSlug) {
          throw new Error("This interview link does not match the requested job and candidate.");
        }
        setDetail(response.interview);
      } catch (loadError) {
        if (!opts?.quiet) setError(loadError instanceof Error ? loadError.message : "Unable to load this interview.");
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [access, candidateSlug, interviewId, jobSlug]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    void loadDetail();
    return () => window.clearInterval(timer);
  }, [loadDetail]);

  const opensAt = detail ? getInterviewJoinOpensAt(detail.scheduledAt) : null;
  const millisecondsUntilOpen = opensAt ? new Date(opensAt).getTime() - now : 0;
  // Feedback submission is what marks an interview "completed", so that is the
  // point at which rejoining stops being offered to either side.
  const joinable = isInterviewJoinable(detail?.status);
  const terminal = Boolean(detail) && !joinable;
  const isExternalMeeting = Boolean(detail && detail.meetingType !== "in-person" && isExternalVideoProvider(detail.videoProvider));
  const isVideo = Boolean(detail && detail.meetingType !== "in-person" && !detail?.location);
  const withinWindow = detail ? now >= new Date(opensAt!).getTime() : false;
  const canJoin = Boolean(
    detail && isVideo && !isExternalMeeting && !terminal && withinWindow && (candidateMode || detail.isAssignedInterviewer)
  );
  const canGiveFeedback = Boolean(detail && !candidateMode && detail.status === "in-progress" && (detail.isAssignedInterviewer || detail.canManage));
  const canManage = Boolean(detail && !candidateMode && detail.canManage && !terminal);

  const { release } = media;
  // Completion is pushed to nobody: the feedback endpoint only notifies HR
  // (app/api/recruitment/interviews/[id]/feedback/route.ts), so the only way the
  // other participant learns the interview is over is by asking. Poll only while
  // the camera is actually open, which also covers someone previewing in the
  // device check without having joined.
  const mediaOpen = Boolean(credentials) || media.status === "ready";
  useEffect(() => {
    if (!mediaOpen || terminal) return;
    const timer = window.setInterval(() => void loadDetail({ quiet: true }), 15000);
    return () => window.clearInterval(timer);
  }, [loadDetail, mediaOpen, terminal]);

  // Nothing else releases the camera: MediaDevicesProvider sits above this screen
  // so the same stream serves the device check and the call, and it only stops
  // the hardware on unmount. Once an interview is over there is no join panel
  // left to switch the camera off, so the transition has to do it explicitly.
  // Latched so the 15s poll, which hands us a fresh `detail` every tick, only
  // trips this once — and re-armed if the interview becomes joinable again.
  const releasedForTerminalRef = useRef(false);
  useEffect(() => {
    if (!detail) return;
    if (!terminal) {
      releasedForTerminalRef.current = false;
      return;
    }
    if (releasedForTerminalRef.current) return;
    releasedForTerminalRef.current = true;
    // Unmounting the dock closes the peer connection, drops the remote video and
    // disconnects signalling (use-webrtc-call.ts), then release() stops the local
    // camera and microphone. No message here on purpose: the terminal branch of the
    // panel already says the interview is over, so a second notice would only
    // repeat it — and the person who just submitted feedback does not need telling.
    setCredentials(null);
    release();
  }, [detail, terminal, release]);

  const candidateName = detail?.candidate
    ? `${detail.candidate.firstName} ${detail.candidate.lastName}`.trim() || "Unknown candidate"
    : "Unknown candidate";

  async function joinCall() {
    if (!detail || !canJoin || joining) return;
    setJoining(true);
    setCallMessage("");
    setCallError("");
    try {
      const result = await apiFetch<RoomCredentials>(
        `/api/recruitment/interviews/${encodeURIComponent(detail.id)}/webrtc-session`,
        {
          method: "POST",
          body: JSON.stringify(access ? { access } : {}),
        },
        { toast: false }
      );
      setCredentials(result);
      setDetail((current) => current ? { ...current, status: "in-progress" } : current);
    } catch (joinError) {
      setCallError(joinError instanceof Error ? joinError.message : "Unable to join the call.");
    } finally {
      setJoining(false);
    }
  }

  function endCall() {
    setCredentials(null);
    setCallMessage("Call ended. You can rejoin while the interview remains in progress.");
  }

  if (loading) return <DetailSkeleton />;

  if (error || !detail) {
    return (
      <div className="grid min-h-screen place-items-center bg-app p-6 text-base">
        <div className="w-full max-w-md rounded-2xl border border-lt bg-card p-8 text-center shadow-card-v">
          <LockKeyhole className="mx-auto text-rose-500" size={30} />
          <h1 className="mt-4 text-xl font-semibold">Interview unavailable</h1>
          <p className="mt-2 text-sm text-sec">{error || "This interview could not be found."}</p>
          <button
            type="button"
            onClick={() => window.history.length > 1 ? router.back() : router.push("/recruitment/interviews")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <ArrowLeft size={16} /> Go back
          </button>
        </div>
      </div>
    );
  }

  // Joining a call no longer replaces this page. The room floats in a dock so the
  // resume, feedback form and actions stay mounted and usable underneath it.
  const inCall = Boolean(credentials);

  return (
    <div className="min-h-screen bg-app p-4 text-base sm:p-6">
      {/* While a call is docked it floats over the bottom-right of this column, so
          reserve matching space to keep the action buttons reachable. */}
      <div className={`mx-auto max-w-6xl space-y-5 ${inCall ? "pb-[30rem] sm:pb-[28rem]" : ""}`}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? router.back() : router.push(candidateMode ? "/candidate-portal" : "/recruitment/interviews")}
            className="inline-flex items-center gap-2 rounded-xl border border-lt bg-card px-3.5 py-2.5 text-sm font-semibold shadow-card-v transition hover:bg-surface-hover"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${statusClasses(detail.status)}`}>{detail.status.replace("-", " ")}</span>
        </header>

        <section className="overflow-hidden rounded-2xl border border-lt bg-card shadow-card-v">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {detail.roundType} round
                </span>
                {detail.meetingType === "in-person" || detail.location ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">In person</span>
                ) : isExternalMeeting ? (
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">{videoProviderLabel(detail.videoProvider)}</span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Video interview</span>
                )}
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{candidateName}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-sec"><Briefcase size={15} /> {detail.job?.title ?? "Position"}</p>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-xl bg-muted p-3">
                  <CalendarDays className="mt-0.5 text-indigo-500" size={17} />
                  <div><p className="text-xs text-dim">Scheduled for</p><p className="mt-0.5 font-medium">{formatDateTime(detail.scheduledAt)}</p></div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-muted p-3">
                  <UserRound className="mt-0.5 text-indigo-500" size={17} />
                  <div><p className="text-xs text-dim">Interviewer</p><p className="mt-0.5 font-medium">{detail.interviewer?.name ?? "Not assigned"}</p></div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 text-center dark:border-indigo-900 dark:bg-indigo-950/40 lg:w-80">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><Video size={22} /></span>
              {!isVideo ? (
                <>
                  <p className="mt-4 text-sm font-semibold">In-person interview</p>
                  <p className="mt-1 text-xs leading-5 text-sec">Join at the scheduled location. Video calling is not enabled.</p>
                </>
              ) : terminal ? (
                <>
                  <p className="mt-4 text-sm font-semibold">Call unavailable</p>
                  <p className="mt-1 text-xs leading-5 text-sec">This interview is {detail.status}.</p>
                </>
              ) : !withinWindow ? (
                <>
                  <p className="mt-4 text-xs font-medium text-sec">Call opens in</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{formatInterviewCountdown(millisecondsUntilOpen)}</p>
                  <p className="mt-2 text-xs text-sec">Join becomes available five minutes before the scheduled time.</p>
                </>
              ) : !candidateMode && !detail.isAssignedInterviewer ? (
                <>
                  <p className="mt-4 text-sm font-semibold">Interviewer access only</p>
                  <p className="mt-1 text-xs leading-5 text-sec">Only the assigned interviewer can join the video room.</p>
                </>
              ) : isExternalMeeting ? (
                <>
                  <p className="mt-4 text-sm font-semibold">{videoProviderLabel(detail.videoProvider)} interview</p>
                  <p className="mt-1 text-xs leading-5 text-sec">
                    This interview runs on {videoProviderLabel(detail.videoProvider)}, not the FlowZen video room.
                  </p>
                  {detail.meetingLink ? (
                    <a
                      href={detail.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
                    >
                      <Video size={17} /> Open {videoProviderLabel(detail.videoProvider)}
                    </a>
                  ) : (
                    <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      No meeting link has been added yet.
                    </p>
                  )}
                  {detail.meetingPassword ? (
                    <div className="mt-3 rounded-xl border border-lt bg-card px-3 py-2.5 text-left">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-dim">Passcode</p>
                      <p className="mt-0.5 font-mono text-sm tracking-wider">{detail.meetingPassword}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="mt-4 text-sm font-semibold">Your call is ready</p>
                  <p className="mt-1 text-xs text-sec">Check your camera and microphone first.</p>
                  <div className="mt-4 rounded-2xl bg-slate-950 p-3 text-left">
                    <DeviceCheckPanel />
                  </div>
                  <button
                    type="button"
                    onClick={() => void joinCall()}
                    disabled={joining || media.status === "error" || media.status === "requesting"}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    <Video size={17} /> {joining ? "Joining…" : detail.status === "in-progress" ? "Rejoin call" : "Join call"}
                  </button>
                  {media.status === "error" ? (
                    <p className="mt-2 text-[11px] leading-4 text-rose-600">
                      Your camera and microphone are not ready yet, so joining is paused.
                    </p>
                  ) : null}
                </>
              )}
              {callError ? <p className="mt-3 text-xs leading-5 text-rose-600">{callError}</p> : null}
              {callMessage ? <p className="mt-3 text-xs leading-5 text-sec">{callMessage}</p> : null}
            </div>
          </div>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-2xl border border-lt bg-card p-5 shadow-card-v sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Interview workspace</h2>
                  <p className="mt-1 text-xs text-sec">Candidate context for this interview round.</p>
                </div>
                {canManage && !isVideo ? <span className="inline-flex items-center gap-1.5 text-xs text-sec"><MapPin size={14} /> {detail.location || "Location not provided"}</span> : null}
              </div>

              {!candidateMode && detail.candidate ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-lt p-4"><p className="text-xs text-dim">Email</p><a href={`mailto:${detail.candidate.email}`} className="mt-1 block break-all text-sm font-medium text-indigo-600">{detail.candidate.email || "—"}</a></div>
                  <div className="rounded-xl border border-lt p-4"><p className="text-xs text-dim">Phone</p><a href={`tel:${detail.candidate.phone}`} className="mt-1 block text-sm font-medium">{detail.candidate.phone || "—"}</a></div>
                  <div className="rounded-xl border border-lt p-4"><p className="text-xs text-dim">ATS score</p><p className="mt-1 text-sm font-semibold">{detail.candidate.atsScore != null ? `${detail.candidate.atsScore}/100` : "Not scored"}</p></div>
                  <div className="rounded-xl border border-lt p-4"><p className="text-xs text-dim">Assessment</p><p className="mt-1 text-sm font-semibold">{detail.candidate.assessmentScore != null ? `${detail.candidate.assessmentScore}/100` : "Not assessed"}</p></div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-lt bg-muted/50 p-4 text-sm text-sec">
                  Your interview details are ready. Candidate contact information remains private.
                </div>
              )}

              {detail.job?.requiredSkills?.length ? (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-dim">Required skills</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.job.requiredSkills.map((skill) => <span key={skill} className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-sec">{skill}</span>)}
                  </div>
                </div>
              ) : null}

              {detail.job?.description ? (
                <div className="mt-5 border-t border-lt pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-dim">Job description</p>
                  <JobDescription content={detail.job.description} className="mt-2" />
                </div>
              ) : null}

              {!candidateMode && detail.candidate?.resumeUrl ? (
                <button
                  type="button"
                  onClick={() => setResumeOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-lt px-3.5 py-2.5 text-sm font-semibold transition hover:bg-surface-hover"
                >
                  <Download size={15} /> Candidate resume
                </button>
              ) : null}
            </section>

            {detail.feedback ? (
              <section className="rounded-2xl border border-lt bg-card p-5 shadow-card-v sm:p-6">
                <div className="flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /><h2 className="text-base font-semibold">Interview feedback</h2></div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Technical", detail.feedback.technicalSkills],
                    ["Communication", detail.feedback.communication],
                    ["Problem solving", detail.feedback.problemSolving],
                    ["Culture", detail.feedback.cultureFit],
                  ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-muted p-3"><p className="text-[11px] text-dim">{label}</p><p className="mt-1 text-lg font-bold">{value}/5</p></div>)}
                </div>
                {detail.feedback.notes ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-sec">{detail.feedback.notes}</p> : null}
              </section>
            ) : null}
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-lt bg-card p-5 shadow-card-v">
              <h2 className="text-sm font-semibold">Actions</h2>
              <div className="mt-4 space-y-2.5">
                {canGiveFeedback ? (
                  <button type="button" onClick={() => setFeedbackOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"><FileText size={16} /> Complete & add feedback</button>
                ) : null}
                {canManage && ["scheduled", "rescheduled"].includes(detail.status) ? (
                  <button type="button" onClick={() => setEditOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-lt px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-hover"><Clock3 size={16} /> Edit or reschedule</button>
                ) : null}
                <Link href={candidateMode ? "/candidate-portal" : `/recruitment/candidates/${detail.candidate?.id ?? ""}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-lt px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-hover">
                  {candidateMode ? <Users size={16} /> : <FileText size={16} />} {candidateMode ? "Candidate portal" : "Candidate profile"}
                </Link>
              </div>
              {!candidateMode && !detail.isAssignedInterviewer ? <p className="mt-3 text-xs leading-5 text-dim">HR can manage this interview, but only the assigned interviewer receives a publishing token.</p> : null}
            </section>

            <section className="rounded-2xl border border-lt bg-card p-5 shadow-card-v">
              <h2 className="text-sm font-semibold">Room policy</h2>
              <div className="mt-4 space-y-3 text-xs leading-5 text-sec">
                <p className="flex gap-2"><LockKeyhole className="mt-0.5 shrink-0 text-indigo-500" size={14} /> Join opens exactly five minutes before the scheduled time.</p>
                <p className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-indigo-500" size={14} /> Audio and video travel directly between both participants, encrypted in transit.</p>
                <p className="flex gap-2"><Users className="mt-0.5 shrink-0 text-indigo-500" size={14} /> Only the interviewer can end the call for both participants.</p>
              </div>
              <p className="mt-4 border-t border-lt pt-4 text-[11px] text-dim">The call becomes active when either participant joins. Ending a call does not complete the interview.</p>
            </section>
          </aside>
        </div>
      </div>

      {feedbackOpen ? <AddFeedbackModal interviewId={detail.id} onIvChange={() => { setFeedbackOpen(false); void loadDetail(); }} /> : null}
      {editOpen ? <EditInterviewModal interviewId={detail.id} candidateInterviews={[detail]} onIvChange={() => { setEditOpen(false); void loadDetail(); }} /> : null}
      {resumeOpen && detail.candidate?.resumeUrl ? (
        <ResumeViewerModal
          url={detail.candidate.resumeUrl}
          candidateName={candidateName}
          onClose={() => setResumeOpen(false)}
        />
      ) : null}

      {credentials ? (
        <InterviewDock title={`${candidateName} · ${detail.roundType} round`}>
          <InterviewRoom
            credentials={credentials}
            candidateName={candidateName}
            jobTitle={detail.job?.title ?? "Interview"}
            compact
            onEnd={endCall}
            onPeerEnded={() => {
              setCallMessage("The interviewer ended the call.");
            }}
          />
        </InterviewDock>
      ) : null}
    </div>
  );
}
