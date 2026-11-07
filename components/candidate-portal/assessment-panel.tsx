"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PlayCircle, Clock, Send, CheckCircle, XCircle, Layers, AlertTriangle, Download, Loader2, ChevronLeft, ChevronRight, Eraser, Flag } from "lucide-react";
import { jsPDF } from "jspdf";
import { formatMarks, formatNegativeMarking, negativeMarkingShort } from "@/lib/assessment-negative-marking";
import { MediaDevicesProvider, useMediaDevices } from "@/components/recruitment/interview-room/media-devices";
import { ProctoringPreflight } from "@/components/candidate-portal/proctoring-preflight";
import { ProctoringOverlay } from "@/components/candidate-portal/proctoring-overlay";
import { ProctoringBanner } from "@/components/candidate-portal/proctoring-banner";
import { SelfieTile } from "@/components/candidate-portal/selfie-tile";
import { ExtensionRequest } from "@/components/candidate-portal/extension-request";
import { useProctoring } from "@/components/candidate-portal/use-proctoring";
import { useMicLevel } from "@/components/candidate-portal/use-mic-level";

type Question = { index: number; text: string; options: string[]; type?: "mcq" | "essay"; marks?: number; required?: boolean };

type ProctoringSettings = {
  enabled: boolean;
  requireCamera: boolean;
  requireMic: boolean;
  requireFullscreen: boolean;
  blockOnFocusLoss: boolean;
  noiseThresholdDb: number;
  noiseWarningLimit: number;
  requireSingleFace: boolean;
  blockScreenShare: boolean;
  /** False when HR has waived proctoring for this candidate. */
  exempt?: boolean;
  active?: boolean;
};

type Props = {
  token: string;
  assessment: {
    enabled: boolean;
    durationMinutes: number | null;
    passScore: number;
    negativeMarking: number;
    negativeMarkingLabel?: string;
    proctoring?: ProctoringSettings;
    /** The real configured proctoring, surfaced to the preview walkthrough. */
    previewProctoring?: ProctoringSettings;
    extensionRequest?: { status: "none" | "pending" | "approved" | "denied"; requestedMs: number };
    domains: { name: string; limit: number; questionCount: number }[];
    domain: string;
    answerKeyPublished?: boolean;
    resultPublished?: boolean;
    stage: string;
    startedAt: string | null;
    submittedAt: string | null;
    score: number | null;
    rawMarks?: number | null;
    maxMarks?: number | null;
    status: string;
    eligibleToStart: boolean;
    submittable: boolean;
    endsAt: string | null;
    rejectionNote?: string;
    windowMode: "uniform" | "relief";
    instructions?: string;
    phase: "closed" | "lobby" | "open" | "expired";
    lobbyOpensAt: string | null;
    startsAt: string | null;
    lastEntryAt: string | null;
    untilLobbyMs: number;
    untilStartMs: number;
    slotStart: string | null;
    slots: { start: string; startMs: string }[];
    // Mock-only. The mock track never writes the real assessment's status or
    // score fields, so it reports its outcome through these instead.
    resultRelease?: "immediate" | "delayed" | "never";
    resultDelayHours?: number;
    maxAttempts?: number;
    attemptsUsed?: number;
    attemptNumber?: number | null;
    /** Mock-only: the raw window resolution behind the coarse `phase`. */
    mockWindowPhase?: "scheduled" | "open" | "entry-closed" | "expired" | "unusable" | "disabled" | null;
    result?: {
      attemptNumber: number | null;
      score: number | null;
      rawMarks: number | null;
      maxMarks: number | null;
      passed: boolean | null;
    } | null;
    bestScore?: number | null;
    resultVisible?: boolean;
    answerKeyVisible?: boolean;
    resultVisibleAt?: string | null;
  };
  accent: string;
  companyName?: string;
  onRefresh: () => void;
  /** When true, auto-starts the assessment on mount (used in test tab). */
  autoStart?: boolean;
  /** Which track this render is for. Defaults to the real assessment. */
  mode?: "assessment" | "mock";
  /**
   * HR candidate-experience preview. Every server write path (start, autosave,
   * submit, proctoring logging, extension polling) is replaced by local state
   * and the HR preview endpoints, so nothing about a real candidate moves.
   */
  preview?: boolean;
  /** The job whose preview endpoints serve this render (preview mode only). */
  previewJobId?: string;
};

/** What the preview grade endpoint returns (nothing persisted anywhere). */
type PreviewGrade = {
  mode?: "assessment" | "mock";
  sample?: boolean;
  score?: number | null;
  rawMarks?: number | null;
  maxMarks?: number | null;
  passed?: boolean | null;
  correct?: number | null;
  wrong?: number | null;
  mcqTotal?: number | null;
  essayCount?: number | null;
  hasEssays?: boolean;
  questionCount?: number;
  passScore?: number;
  negativeMarking?: number;
  negativeMarkingLabel?: string;
  answerKeyVisible?: boolean;
  submittedAt?: string | null;
  answerKey?: AnswerKeyPayload | null;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || "").trim().replace("#", "");
  if (clean.length === 3 || clean.length === 6) {
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const n = parseInt(full, 16);
    if (!Number.isNaN(n)) {
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
  }
  return { r: 15, g: 23, b: 42 };
}

type AnswerKeyQuestion = {
  index: number;
  text: string;
  options: string[];
  correctIndex: number;
  marks: number;
  required: boolean;
  type: "mcq" | "essay";
  answer: string;
  selectedOption: number | null;
  textAnswer: string;
};

type AnswerKeyPayload = {
  candidate: { firstName: string; lastName: string; email: string };
  jobTitle: string;
  domain: string | null;
  score: number | null;
  rawMarks: number | null;
  maxMarks: number | null;
  passScore: number;
  negativeMarking: number;
  negativeMarkingLabel?: string;
  startedAt: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  questions: AnswerKeyQuestion[];
};

function generateAnswerKeyPdf(data: AnswerKeyPayload, accent: string, companyName?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const rgb = hexToRgb(accent);
  const green: [number, number, number] = [22, 163, 74];
  const red: [number, number, number] = [220, 38, 38];
  const dark: [number, number, number] = [30, 41, 59];
  const mid: [number, number, number] = [100, 116, 139];

  let y = 0;

  // Header band
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, 0, pageW, 118, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(companyName || "FlowZen", margin, 50);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text("Assessment Question Paper & Answer Key", margin, 72);
  y = 100;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 118, pageW, 30, "F");

  // Candidate info
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  y = 156;
  doc.text(`Candidate: ${data.candidate.firstName || ""} ${data.candidate.lastName || ""}`.trim(), margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mid);
  doc.setFontSize(10);
  doc.text(`Email: ${data.candidate.email}`, margin, y);
  y += 15;
  doc.text(`Job: ${data.jobTitle}${data.domain ? `  ·  Domain: ${data.domain}` : ""}`, margin, y);
  y += 15;
  doc.text(
    `Score: ${data.score != null ? `${data.score}/100` : "—"}${data.rawMarks != null ? `  (${formatMarks(data.rawMarks)}/${formatMarks(data.maxMarks)} marks)` : ""}  ·  Passing threshold: ${data.passScore}%`,
    margin,
    y
  );
  y += 15;
  if (data.startedAt && data.submittedAt) {
    doc.text(
      `Assessment date: ${new Date(data.startedAt).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} – ${new Date(data.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      margin,
      y
    );
    y += 15;
  }
  if (data.negativeMarking > 0) {
    doc.text(`Negative marking: -${formatNegativeMarking(data.negativeMarking, data.negativeMarkingLabel)} per wrong answer`, margin, y);
    y += 15;
  }
  if (data.publishedAt) {
    doc.text(`Answer key published: ${new Date(data.publishedAt).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, margin, y);
    y += 15;
  }

  // Result legend box
  if (y > pageH - 70) { doc.addPage(); y = 48; }
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, pageW - margin * 2, 36, 4, 4, "S");
  doc.setTextColor(...mid);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("How to read this paper:", margin + 10, y + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...green);
  doc.text("Correct", margin + 10, y + 26);
  doc.setTextColor(...mid);
  doc.setFont("helvetica", "normal");
  doc.text(`+${Math.max(1, data.questions[0]?.marks || 1)} marks gained`, margin + 68, y + 26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...red);
  doc.text("Wrong", margin + 175, y + 26);
  doc.setTextColor(...mid);
  doc.setFont("helvetica", "normal");
  doc.text(data.negativeMarking > 0 ? `-${negativeMarkingShort(data.negativeMarking, data.negativeMarkingLabel)} marks penalty` : "no marks", margin + 230, y + 26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...mid);
  doc.text("Not answered", margin + 330, y + 26);
  doc.setFont("helvetica", "normal");
  doc.text("no marks", margin + 415, y + 26);
  if (data.questions.some((qq) => qq.type === "essay")) {
    doc.setTextColor(...mid);
    doc.text("Essay questions: your answer vs expected answer, reviewed manually.", margin + 10, y + 33);
  }
  y += 44; // spacing after legend
  const lineHeight = 12;

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];

    if (y > pageH - 90) {
      doc.addPage();
      y = 48;
    }

    // Question header
    const qHeader = `${i + 1}. ${q.text}   (+${q.marks} marks${q.required ? " · Required" : " · Optional"})`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    const wrappedQ = doc.splitTextToSize(qHeader, pageW - margin * 2);
    if (y + wrappedQ.length * lineHeight + 8 > pageH - 60) {
      doc.addPage();
      y = 48;
    }
    doc.text(wrappedQ, margin, y);
    y += wrappedQ.length * lineHeight + 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    if (q.type === "essay") {
      const writeBlock = (label: string, content: string, color: [number, number, number]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...color);
        const lblWrapped = doc.splitTextToSize(label, pageW - margin * 2 - 14);
        if (y + lblWrapped.length * lineHeight + 4 > pageH - 60) { doc.addPage(); y = 48; }
        doc.text(lblWrapped, margin + 14, y);
        y += lblWrapped.length * lineHeight + 3;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...dark);
        const contentWrapped = doc.splitTextToSize(content || "(no answer)", pageW - margin * 2 - 24);
        if (y + contentWrapped.length * lineHeight + 6 > pageH - 60) { doc.addPage(); y = 48; }
        doc.text(contentWrapped, margin + 26, y);
        y += contentWrapped.length * lineHeight + 8;
      };
      writeBlock("Your answer:", q.textAnswer || "(no answer)", red);
      if (q.answer) writeBlock("Expected answer:", q.answer, green);
    } else {
      for (let oi = 0; oi < q.options.length; oi++) {
        const letter = String.fromCharCode(65 + oi);
        const isSelected = q.selectedOption === oi;
        const isCorrect = q.correctIndex === oi;
        let suffix = "";
        let color: [number, number, number] = dark;
        if (isSelected && isCorrect) { suffix = "      [YOUR ANSWER — CORRECT]"; color = green; }
        else if (isSelected) { suffix = "      [YOUR ANSWER]"; color = red; }
        else if (isCorrect) { suffix = "      [CORRECT ANSWER]"; color = green; }
        const optText = `  ${letter}) ${q.options[oi] || ""}${suffix}`;
        const wrapped = doc.splitTextToSize(optText, pageW - margin * 2);
        if (y + wrapped.length * lineHeight + 4 > pageH - 60) { doc.addPage(); y = 48; }
        doc.setTextColor(...color);
        doc.setFont("helvetica", isSelected || isCorrect ? "bold" : "normal");
        doc.text(wrapped, margin, y);
        y += wrapped.length * lineHeight + 3;
      }
    }

    // Per-question result (gained / lost marks)
    if (y > pageH - 60) { doc.addPage(); y = 48; }
    let resultText = "";
    let resultColor: [number, number, number] = mid;
    if (q.type === "essay") {
      resultText = "— Essay · reviewed manually";
    } else if (q.selectedOption == null) {
      resultText = "— Not answered (no marks)";
    } else if (q.selectedOption === q.correctIndex) {
      resultText = `— Correct  +${q.marks} marks`;
      resultColor = green;
    } else {
      resultText = data.negativeMarking > 0 ? `— Wrong  -${negativeMarkingShort(data.negativeMarking, data.negativeMarkingLabel)} marks` : "— Wrong (no marks)";
      resultColor = red;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...resultColor);
    doc.text(resultText, margin, y);
    y += 14; // gap between questions
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mid);
    doc.text(`FlowZen Assessment · ${data.candidate.firstName || ""} ${data.candidate.lastName || ""} · Page ${p} of ${pages}`, margin, pageH - 24);
  }

  const safeName = `${data.candidate.firstName || "candidate"}-${data.candidate.lastName || ""}`.replace(/[^a-zA-Z0-9-_]+/g, "").toLowerCase().replace(/^-+|-+$/g, "") || "candidate";
  const safeJob = (data.jobTitle || "assessment").replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "") || "assessment";
  doc.save(`answer-key-${safeJob}-${safeName}.pdf`);
}

/**
 * Thin provider wrapper.
 *
 * The media provider has to sit above the panel so the preflight and the exam
 * share one acquisition: a device approved on the preflight screen is the same
 * device the exam uses, and React's StrictMode double-mount must not open the
 * camera twice (see the notes in media-devices.tsx).
 */
export function AssessmentPanel(props: Props) {
  return (
    <MediaDevicesProvider>
      <AssessmentPanelInner {...props} />
    </MediaDevicesProvider>
  );
}

function AssessmentPanelInner({ token, assessment, accent, companyName, onRefresh, autoStart, mode = "assessment", preview = false, previewJobId = "" }: Props) {
  // The mock track is a separate sitting with its own paper, answers and clock,
  // so every request and every cache key is scoped by mode. Nothing is shared
  // with the real assessment, and omitting the param keeps the real endpoints.
  const isMock = mode === "mock";
  const trackQs = isMock ? "&mode=mock" : "";
  const cacheKey = `ap-${token}${isMock ? "-mock" : ""}`;

  // The portal tab and the exam tab are separate documents, so a domain or slot
  // picked in one has to travel to the other. The exam tab is opened with these
  // params so the choice is not silently lost.
  const [handedOff] = useState(() => {
    if (typeof window === "undefined") return { domain: "", slot: null as string | null };
    const params = new URLSearchParams(window.location.search);
    return { domain: params.get("domain") || "", slot: params.get("slot") };
  });

  const [started, setStarted] = useState(assessment.submittable);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, { selectedOption?: number; textAnswer?: string }>>({});
  // Exam-console navigation: one question on screen at a time, a numbered
  // palette with statuses, and review flags. All array-index (display order)
  // keyed; the flags travel in the localStorage cache so a resume keeps them.
  const [currentQ, setCurrentQ] = useState(0);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(Boolean(assessment.submittedAt));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(handedOff.domain || assessment.domain || "");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(handedOff.slot || assessment.slotStart || null);
  const [inLobby, setInLobby] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [downloading, setDownloading] = useState(false);
  // Proctoring: `preflight` gates the start behind the device check, and
  // `proctorReady` is what the preflight's Begin button flips.
  const [preflight, setPreflight] = useState(false);
  const [proctorReady, setProctorReady] = useState(false);
  const [beginBusy, setBeginBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Set when the browser refused the exam tab, so the candidate gets an
  // explicit link instead of a silent no-op.
  const [popupBlockedUrl, setPopupBlockedUrl] = useState("");
  const [extension, setExtension] = useState({
    status: (assessment.extensionRequest?.status ?? "none") as "none" | "pending" | "approved" | "denied",
    requestedMs: assessment.extensionRequest?.requestedMs ?? 0,
    grantedMs: 0,
  });
  const [previewClock, setPreviewClock] = useState<{ startedAt: string | null; endsAt: string | null }>({
    startedAt: null,
    endsAt: null,
  });
  const [previewGrade, setPreviewGrade] = useState<PreviewGrade | null>(null);
  // True while this run is on flagged sample questions (empty bank fallback).
  const [previewSample, setPreviewSample] = useState(false);
  const autoSubmittedRef = useRef(false);
  const autoSubmitRef = useRef<() => void>(() => {});
  const autoStartRef = useRef(false);
  const lobbyFetchRef = useRef(false);

  const media = useMediaDevices();
  // Proctoring: in preview the walkthrough config comes from `previewProctoring`,
  // while the config handed to useProctoring below stays blank so its violation
  // logging and overlays never run — nothing is recorded or uploaded here.
  const proctoringSettings = (preview ? assessment.previewProctoring : assessment.proctoring) ?? null;
  const proctoringWanted = preview ? false : Boolean(proctoringSettings?.active);
  // The preflight flow in the pre-exam card; in preview it is driven by the real
  // configured settings, but nothing behind it posts anywhere.
  const preflightWanted = preview ? Boolean(assessment.previewProctoring?.active) : proctoringWanted;
  // A candidate resuming an already-started paper skips the preflight; the
  // devices are opened in the background and the overlay covers any gap.
  const sitting = started && questions.length > 0 && !submitted;
  const proctoring = useProctoring({
    token,
    stream: media.stream,
    running: sitting,
    config: preview ? null : proctoringSettings,
    cameraReady: Boolean(media.stream?.getVideoTracks().some((t) => t.enabled)),
    onRetryCamera: () => void media.retry(),
  });
  // The preflight needs its own mic reading, taken before the exam starts, so
  // this one is deliberately not driven by the sitting flag above.
  const preflightMic = useMicLevel(media.stream, preflight && preflightWanted);

  // "The device attempt has settled" — either it worked or it failed with a
  // message, and in both cases the preflight is ready to be acted on rather than
  // sitting in a permanent disabled state.
  useEffect(() => {
    if (media.status === "ready" || media.status === "error") setProctorReady(true);
  }, [media.status]);

  /**
   * Suppress the ways the paper can be copied or printed out.
   *
   * This is friction, not a security control: a determined candidate can read the
   * DOM or the network payload either way, and nothing here stops that. It only
   * removes the accidental and the lazy paths.
   */
  useEffect(() => {
    if (!sitting || !proctoringWanted) return;
    const stop = (e: Event) => e.preventDefault();
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("copy", stop);
    document.addEventListener("cut", stop);
    document.addEventListener("paste", stop);
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("beforeprint", stop);
    return () => {
      document.removeEventListener("copy", stop);
      document.removeEventListener("cut", stop);
      document.removeEventListener("paste", stop);
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("beforeprint", stop);
    };
  }, [sitting, proctoringWanted]);

  // Keep the default selection on a slot that is still open. A candidate who
  // opens the portal after their slot ended (but before the last slot of the day)
  // should land on the next usable time rather than on a dead one.
  useEffect(() => {
    if (assessment.startedAt || assessment.windowMode !== "uniform" || !assessment.slots.length) return;
    setSelectedSlot((prev) => {
      const isUsable = (s: string | null) =>
        s !== null && assessment.slots.some((slot) => slot.start === s && new Date(slot.startMs).getTime() > Date.now());
      if (isUsable(prev)) return prev;
      return assessment.slots.find((slot) => new Date(slot.startMs).getTime() > Date.now())?.start ?? null;
    });
  }, [assessment.startedAt, assessment.windowMode, assessment.slots]);

  // ── Phase ──────────────────────────────────────────────────────────────────
  // Derived from the server's absolute timestamps plus a local ticker, never
  // from whether questions happen to be loaded — otherwise a lobby entry (which
  // serves no questions) would be indistinguishable from being ready to start.
  const startsAtMs = assessment.startsAt ? new Date(assessment.startsAt).getTime() : null;
  const lobbyOpensAtMs = assessment.lobbyOpensAt ? new Date(assessment.lobbyOpensAt).getTime() : null;
  // In preview the exam clock is anchored client-side when HR presses Start;
  // the payload itself carries no candidate, so both fields start out blank.
  const previewEndsAt = preview ? previewClock.endsAt : assessment.endsAt;
  const examEndsAtMs = previewEndsAt ? new Date(previewEndsAt).getTime() : null;

  const isExam = assessment.phase === "open" && Boolean(preview ? previewClock.startedAt : assessment.startedAt);
  const isClosed = assessment.phase === "closed";
  const isExpired = assessment.phase === "expired";
  const inExamWindow = isExam && examEndsAtMs !== null && now < examEndsAtMs;
  const untilLobbyMs = lobbyOpensAtMs === null ? 0 : Math.max(0, lobbyOpensAtMs - now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // A payload fetched before the window opened stays frozen at "closed" —
  // eligibility is stamped on the server at fetch time, not recomputed here.
  // When the local clock crosses the lobby-open instant (the mock's window open
  // targets the same field), refetch once so the phase — and with it the Start
  // button — catches up without the candidate reloading the page. Guarded by
  // the target instant: a refetch that still lands on "closed" must not loop.
  const lobbyRefetchRef = useRef<number | null>(null);
  useEffect(() => {
    if (preview || started || submitted || assessment.phase !== "closed") return;
    if (lobbyOpensAtMs === null || now < lobbyOpensAtMs) return;
    if (lobbyRefetchRef.current === lobbyOpensAtMs) return;
    lobbyRefetchRef.current = lobbyOpensAtMs;
    onRefresh();
  }, [preview, started, submitted, assessment.phase, now, lobbyOpensAtMs, onRefresh]);

  // ── Why the Start button is off ────────────────────────────────────────────
  // `eligibleToStart` is false for several unrelated reasons — window not open,
  // stage not eligible, attempts used up, or an attempt already sitting. The
  // pre-exam view must say which, instead of collapsing every case into the
  // old catch-all "you have used all your attempts" copy.
  const stageEligible = ["screening", "assessment"].includes(assessment.stage);
  /** A mock attempt open and unsubmitted: the candidate is mid-paper. */
  const mockResumable = isMock && Boolean(assessment.submittable) && !submitted;
  const mockExhausted =
    isMock &&
    !mockResumable &&
    assessment.attemptsUsed != null &&
    assessment.maxAttempts != null &&
    assessment.attemptsUsed >= assessment.maxAttempts;
  const awaitingStage = !stageEligible && !mockExhausted;

  // Exam clock. Derived on every render from the absolute deadline against the
  // local ticker, rather than held in state and decremented by an effect: a
  // backgrounded tab that throttles its timers can neither freeze the display
  // past the deadline nor hand out extra time once it wakes up.
  const remaining = isExam && examEndsAtMs !== null && !submitted ? Math.max(0, Math.ceil((examEndsAtMs - now) / 1000)) : null;

  const doSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError("");
    try {
      const answerArray = questions.map((q) => ({
        questionIndex: q.index,
        selectedOption: answers[q.index]?.selectedOption ?? null,
        ...(q.type === "essay" ? { textAnswer: answers[q.index]?.textAnswer ?? "" } : {}),
      }));
      if (preview) {
        // Grade-only dry run: the HR endpoint rebuilds the same preview paper
        // and scores it with the shared scorer, persisting nothing anywhere.
        const res = await fetch(`/api/recruitment/jobs/${previewJobId}/assessment/preview/grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: isMock ? "mock" : undefined,
            domain: assessment.domain || selectedDomain || "",
            autoSubmitted: examEndsAtMs !== null && Date.now() >= examEndsAtMs,
            answers: answerArray,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Preview grading failed.");
        setPreviewGrade(data as PreviewGrade);
        setSubmitted(true);
        onRefresh();
        return;
      }
      const res = await fetch(`/api/public/candidate/me/assessment/submit?token=${encodeURIComponent(token)}${trackQs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answerArray }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed.");
      setSubmitted(true);
      onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }, [answers, questions, submitted, submitting, token, trackQs, onRefresh, preview, previewJobId, isMock, assessment.domain, selectedDomain, examEndsAtMs]);

  const autoSubmit = useCallback(async () => {
    if (autoSubmittedRef.current || submitting || submitted) return;
    autoSubmittedRef.current = true;
    await doSubmit();
  }, [doSubmit, submitting, submitted]);

  // Keep ref always pointing to the latest autoSubmit
  useEffect(() => {
    autoSubmitRef.current = autoSubmit;
  }, [autoSubmit]);

  // Auto-submit at the deadline. Gated on the exam phase: the lobby also counts
  // down to zero, and submitting then would grade an empty attempt.
  useEffect(() => {
    if (!isExam || remaining !== 0 || submitted || autoSubmittedRef.current) return;
    autoSubmitRef.current();
  }, [remaining, submitted, isExam]);

  // Leaving the waiting room: when the start instant arrives, fetch the
  // questions. The server withholds them until then, so this is the moment the
  // exam actually begins.
  useEffect(() => {
    if (!inLobby || submitted || lobbyFetchRef.current) return;
    if (startsAtMs === null || now < startsAtMs) return;
    lobbyFetchRef.current = true;
    void handleStart();
  }, [inLobby, now, startsAtMs, submitted]);

  // Auto-start when test tab opens (only fires once)
  useEffect(() => {
    if (!autoStart || autoStartRef.current) return;
    autoStartRef.current = true;

    if (isExam) {
      // Already running: restore from the cache, otherwise refetch.
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          const { q, a, m, attempt } = JSON.parse(stored);
          const sameAttempt = attempt == null || assessment.attemptNumber == null || attempt === assessment.attemptNumber;
          if (Array.isArray(q) && q.length > 0 && sameAttempt) {
            setQuestions(q);
            if (a && typeof a === "object") setAnswers(a);
            if (Array.isArray(m))
              setMarked(
                new Set<number>(
                  m.filter((i: unknown) => typeof i === "number" && i >= 0 && i < q.length)
                )
              );
            // Proctoring still has to bring the camera up, even when the paper is
            // being restored from cache rather than re-fetched.
            if (proctoringWanted) void media.acquire();
            return;
          }
        }
      } catch {}
      if (proctoringWanted) {
        setPreflight(true);
        setProctorReady(false);
        void media.acquire();
        return;
      }
      void handleStart();
      return;
    }

    if (submitted || !assessment.eligibleToStart) return;

    // A domain still has to be chosen before the exam can be served — either one
    // already stored on the candidate, or one handed over from the portal tab.
    if (assessment.domains?.length && !assessment.domain && !selectedDomain) return;

    // A proctored sitting never starts on its own: it waits for the candidate to
    // pass the device check and press Begin, which is also the only gesture that
    // can grant fullscreen in a window opened by window.open().
    if (proctoringWanted) {
      setPreflight(true);
      setProctorReady(false);
      void media.acquire();
      return;
    }

    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const { q, a, m, attempt } = JSON.parse(stored);
        const sameAttempt = attempt == null || assessment.attemptNumber == null || attempt === assessment.attemptNumber;
        if (Array.isArray(q) && q.length > 0 && sameAttempt) {
          setQuestions(q);
          setStarted(true);
          if (a && typeof a === "object") setAnswers(a);
          if (Array.isArray(m))
            setMarked(
              new Set<number>(
                m.filter((i: unknown) => typeof i === "number" && i >= 0 && i < q.length)
              )
            );
          return;
        }
      }
    } catch {}

    void handleStart();
  }, [autoStart]);

  /**
   * Enter or advance the assessment.
   *
   * The endpoint returns no questions while the candidate is in the waiting
   * room; the same call made after the start instant is what begins the exam, so
   * this single function covers lobby entry, starting, and resuming.
   *
   * Resolves to whether it succeeded — the caller keeps the preflight open on
   * failure so the error (and the popup fallback link) stay on screen.
   */
  async function handleStart(options?: { proctoringAck?: boolean; devices?: string }): Promise<boolean> {
    setError("");
    if (assessment.domains?.length && !selectedDomain && !assessment.domain) {
      setError("Please select your domain to start the assessment.");
      return false;
    }

    // Preview: no server-side sitting and no new tab — the paper comes from the
    // HR preview endpoint and the clock is anchored here.
    if (preview) {
      try {
        const params = new URLSearchParams({ start: "1" });
        if (isMock) params.set("mode", "mock");
        const domain = assessment.domain || selectedDomain;
        if (domain) params.set("domain", domain);
        const url = `/api/recruitment/jobs/${previewJobId}/assessment/preview?${params.toString()}`;
        console.warn("[preview] starting:", url, "domain=", domain, "assessment.domain=", assessment.domain);
        const res = await fetch(url);
        const data = await res.json().catch((e) => { console.error("[preview] json parse err", e); return null as any; });
        console.warn("[preview] status:", res.status, "questions:", (data && data.questions && data.questions.length) || 0, "data=", data);
        if (!res.ok) throw new Error((data && data.error) || "Could not load the preview paper.");
        setQuestions(data.questions || []);
        setStarted(true);
        setInLobby(false);
        setPreviewClock({ startedAt: new Date().toISOString(), endsAt: data.endsAt || null });
        setPreviewSample(Boolean(data.sample));
        if (data.domain) setSelectedDomain(data.domain);
        // Don't refetch the whole info payload here: it would reset state
        // mid-transition. The panel holds all it needs in local state.
        return true;
      } catch (e: any) {
        const msg = e?.message || String(e);
        console.error("[preview] handleStart error:", msg, e);
        try { window.alert("Preview start failed: " + msg); } catch {}
        setError(msg);
        return false;
      }
    }

    // Normal mode: the exam runs in its own tab so it survives navigating away
    // from the portal. Carry the pending domain, slot and track across with it.
    //
    // Must stay synchronous with the click that got us here: any await before
    // window.open() lets the popup blocker reject it.
    if (!autoStart) {
      const params = new URLSearchParams({ token, test: "true" });
      if (isMock) params.set("mode", "mock");
      const domain = assessment.domain || selectedDomain;
      if (domain) params.set("domain", domain);
      if (selectedSlot) params.set("slot", selectedSlot);
      const url = `/candidate-portal?${params.toString()}`;
      const opened = window.open(url, "_blank");
      setPopupBlockedUrl(opened ? "" : url);
      if (!opened) {
        setError("Your browser blocked the exam tab. Allow popups for this site, or use the link below.");
      }
      return Boolean(opened);
    }

    try {
      // Only commit to a slot that has not already closed; otherwise let the
      // server resolve the next one, so a stale selection is not a dead end.
      const slotIsOpen =
        !selectedSlot ||
        assessment.slots.some((s) => s.start === selectedSlot && new Date(s.startMs).getTime() > Date.now());

      const res = await fetch(`/api/public/candidate/me/assessment/start?token=${encodeURIComponent(token)}${trackQs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: assessment.domain || selectedDomain,
          slotStart: slotIsOpen ? selectedSlot : null,
          ...(options?.proctoringAck ? { proctoringAck: true, devices: options.devices } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start.");

      if (data.waiting) {
        // In the waiting room: remember the commitments, show no questions.
        setInLobby(true);
        setStarted(false);
        setSelectedDomain(data.domain || selectedDomain);
        if (data.slotStart) setSelectedSlot(data.slotStart);
        onRefresh();
        return true;
      }

      setQuestions(data.questions || []);
      setStarted(true);
      setInLobby(false);
      lobbyFetchRef.current = true;
      if (data.domain) setSelectedDomain(data.domain);
      if (data.slotStart) setSelectedSlot(data.slotStart);
      onRefresh();
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          q: data.questions || [],
          e: data.endsAt,
          // One cached paper belongs to exactly one attempt; the restore
          // readers check this so a retake never replays the earlier paper.
          attempt: (data as any).attemptNumber ?? null,
        }));
      } catch {}
      return true;
    } catch (e: any) {
      setError(e.message);
      lobbyFetchRef.current = false;
      return false;
    }
  }

  /**
   * The preflight's "Begin assessment".
   *
   * In the portal tab (!autoStart) the only job of this gesture is to open the
   * exam tab, so `handleStart` runs first with no await in front of it — the
   * popup blocker only lets window.open() through inside the click itself.
   * Fullscreen is deliberately NOT requested here: the exam runs in the new
   * tab, where the candidate's own Begin press (autoStart) requests it.
   *
   * In the exam tab (autoStart) fullscreen is requested first, still inside
   * the click handler, because that is the only context in which a browser
   * will grant it. The request is best-effort: if it is refused the exam still
   * starts, and the guard downgrades to a warning rather than a block it could
   * never satisfy.
   */
  async function beginProctoredAssessment() {
    setBeginBusy(true);
    setError("");
    try {
      const devices =
        media.stream?.getVideoTracks().some((t) => t.enabled) &&
        media.stream?.getAudioTracks().some((t) => t.enabled)
          ? "ok"
          : "partial";
      if (!preview && autoStart && proctoringSettings?.requireFullscreen !== false) {
        await proctoring.requestFullscreen().catch(() => false);
      }
      const ok = await handleStart({ proctoringAck: true, devices });
      // Stay on the preflight when the start failed, so the candidate reads the
      // error (or the popup fallback link) instead of a silent close.
      if (ok) setPreflight(false);
    } finally {
      setBeginBusy(false);
    }
  }

  /** Overlay "Return to fullscreen", which is also a user gesture. */
  async function restoreFullscreen() {
    setRestoring(true);
    try {
      await proctoring.requestFullscreen().catch(() => false);
    } finally {
      setRestoring(false);
    }
  }

  /**
   * Shown when window.open() came back null. A direct click on an anchor is a
   * fresh user gesture, so this link works even after the popup was blocked.
   */
  const popupBlockedLink = popupBlockedUrl ? (
    <p className="mt-2 text-sm">
      <a
        href={popupBlockedUrl}
        target="_blank"
        rel="noopener"
        className="font-medium text-slate-900 underline underline-offset-2 hover:opacity-75 dark:text-zinc-100"
      >
        Open the exam in a new tab
      </a>
    </p>
  ) : null;

  // An HR-approved extension lands in the portal payload on the next refresh;
  // poll while sitting so a granted request moves the visible clock without the
  // candidate having to reload.
  useEffect(() => {
    if (!sitting || extension.status !== "pending") return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/public/candidate/me/assessment/extension?token=${encodeURIComponent(token)}`
        );
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return;
        setExtension((prev) => ({ ...prev, ...data }));
        if (data.status !== "pending") {
          onRefresh();
          window.clearInterval(timer);
        }
      } catch {
        // A failed poll just means the status is checked again shortly.
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [sitting, extension.status, token, onRefresh]);

  // Debounced autosave so a closed tab or a crash never loses answered work,
  // and so the background auto-submit has real answers to grade.
  const answersRef = useRef(answers);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!isExam || submitted || preview) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload = questions.map((q) => ({
        questionIndex: q.index,
        selectedOption: answersRef.current[q.index]?.selectedOption ?? null,
        ...(q.type === "essay" ? { textAnswer: answersRef.current[q.index]?.textAnswer ?? "" } : {}),
      }));
      if (!payload.length) return;
      fetch(`/api/public/candidate/me/assessment/answers?token=${encodeURIComponent(token)}${trackQs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      }).catch(() => {});
    }, 1200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [answers, questions, isExam, submitted, token, trackQs]);

  // A fresh paper always opens on its first question with a clean palette.
  useEffect(() => {
    setCurrentQ(0);
    setVisited(new Set([0]));
  }, [questions]);

  // Mirror the console flags (and the answers, which the resume path below
  // reads back) into the localStorage cache, so a reload keeps the palette
  // state as the server autosave only knows about answer payloads.
  useEffect(() => {
    if (!started || questions.length === 0 || preview) return;
    try {
      const raw = localStorage.getItem(cacheKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || !Array.isArray(parsed.q)) return;
      localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, a: answers, m: Array.from(marked) }));
    } catch {}
    // cacheKey and trackQs are stable for a token; listed for lint honesty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, marked, started, questions]);


  function setAnswer(qIndex: number, selectedOption: number) {
    setAnswers((prev) => ({ ...prev, [qIndex]: { ...prev[qIndex], selectedOption } }));
  }

  function setTextAnswer(qIndex: number, textAnswer: string) {
    setAnswers((prev) => ({ ...prev, [qIndex]: { ...prev[qIndex], textAnswer } }));
  }

  /** NTA-style answer status the palette and its counters rely on. */
  function isAnsweredQuestion(q: Question): boolean {
    return q.type === "essay"
      ? Boolean(String(answers[q.index]?.textAnswer ?? "").trim())
      : typeof answers[q.index]?.selectedOption === "number";
  }

  const questionCardRef = useRef<HTMLDivElement>(null);

  function goToQuestion(qi: number) {
    const next = Math.min(Math.max(qi, 0), questions.length - 1);
    setCurrentQ(next);
    setVisited((prev) => {
      if (prev.has(next)) return prev;
      const set = new Set(prev);
      set.add(next);
      return set;
    });
    // Keep the question in view when moving between long or short entries.
    requestAnimationFrame(() => questionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function clearCurrentResponse() {
    const q = questions[currentQ];
    if (!q) return;
    setAnswers((prev) => {
      const next = { ...prev };
      next[q.index] = { ...next[q.index], selectedOption: undefined, textAnswer: undefined };
      return next;
    });
  }

  function toggleMarkCurrent() {
    setMarked((prev) => {
      const set = new Set(prev);
      if (set.has(currentQ)) set.delete(currentQ);
      else set.add(currentQ);
      return set;
    });
  }

  async function handleSubmitClick() {
    // Exam consoles don't leave the candidate to hunt for a missed required
    // question: report the numbers and jump straight to the first one.
    const missing: number[] = [];
    questions.forEach((q, qi) => {
      if (!q.required) return;
      const a = answers[q.index];
      const answered =
        q.type === "essay"
          ? Boolean(a && String(a.textAnswer || "").trim())
          : a != null && typeof a.selectedOption === "number";
      if (!answered) missing.push(qi);
    });
    if (missing.length) {
      setError(
        `Please answer the required question${missing.length > 1 ? "s" : ""}: ${missing
          .map((qi) => qi + 1)
          .join(", ")}.`
      );
      goToQuestion(missing[0]);
      return;
    }
    await doSubmit();
  }

  async function handleDownloadAnswerKey() {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      if (preview) {
        if (previewGrade?.answerKey) generateAnswerKeyPdf(previewGrade.answerKey, accent, companyName);
        setDownloading(false);
        return;
      }
      const res = await fetch(`/api/public/candidate/me/assessment/answer-key?token=${encodeURIComponent(token)}${trackQs}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Could not load the answer key.");
      generateAnswerKeyPdf(data, accent, companyName);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────
  // Schedule labels are pinned to IST so every candidate sees the wall clock
  // HR typed, regardless of their own device zone (lib/date-utils contract).
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  const hasDomains = Array.isArray(assessment.domains) && assessment.domains.length > 0;

  // The scheduled anchor: the chosen slot for uniform mode, otherwise the
  // window's own start. `startsAt` is null in relief mode until they begin.
  const anchorIso = assessment.slotStart || (assessment.windowMode === "uniform" ? assessment.startsAt : assessment.startsAt);
  const scheduleText = anchorIso ? `${fmtDay(anchorIso)} at ${fmtClock(anchorIso)}` : assessment.startsAt ? `${fmtDay(assessment.startsAt)}` : "";

  /** Shared date/countdown switch: date when far out, h/m/s inside 24 hours. */
  function renderCountdown(targetMs: number) {
    const diff = targetMs - now;
    if (diff > 24 * 60 * 60 * 1000) {
      return <span>{fmtDay(new Date(targetMs).toISOString())} at {fmtClock(new Date(targetMs).toISOString())}</span>;
    }
    const s = Math.max(0, Math.floor(diff / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return (
      <span className="font-mono tabular-nums">
        {h > 0 ? `${h}h ` : ""}{m}m {String(sec).padStart(2, "0")}s
      </span>
    );
  }

  function closedMessage() {
    // The mock has no waiting room to enter — its window simply opens and
    // closes — so the copy describes the window itself. In particular
    // "entry-closed" (the last possible start has passed) must get its own
    // truthful wording rather than "The waiting room is open.".
    if (isMock) {
      if (assessment.mockWindowPhase === "entry-closed") {
        return (
          <span>
            The last time to start this mock test has passed{assessment.lastEntryAt ? ` — it had to start by ${fmtDay(assessment.lastEntryAt)} at ${fmtClock(assessment.lastEntryAt)}` : ""}. Please contact the hiring team if you think this is a mistake.
          </span>
        );
      }
      if (assessment.mockWindowPhase === "unusable") {
        return <span>This mock test is not available right now. Please contact the hiring team.</span>;
      }
      if (untilLobbyMs > 0) {
        return (
          <span>
            The mock test opens in {renderCountdown(assessment.lobbyOpensAt ? new Date(assessment.lobbyOpensAt).getTime() : now + untilLobbyMs)}
            {scheduleText ? ` · mock test on ${scheduleText}` : ""}.
          </span>
        );
      }
      return <span>The mock test is open.</span>;
    }
    if (untilLobbyMs <= 0) return "The waiting room is open.";
    return (
      <span>
        The waiting room opens in {renderCountdown(assessment.lobbyOpensAt ? new Date(assessment.lobbyOpensAt).getTime() : now + untilLobbyMs)}
        {scheduleText ? ` · assessment on ${scheduleText}` : ""}.
      </span>
    );
  }

  const renderDomainPicker = () => (
    <>
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
        <Layers size={14} style={{ color: accent }} /> Select your domain
      </p>
      <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
        You will answer the general questions plus the questions of your selected domain.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {assessment.domains.map((d) => (
          <label
            key={d.name}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--c-border-light)] px-3 py-2.5 transition dark:border-zinc-800"
            style={selectedDomain === d.name ? { borderColor: accent, backgroundColor: accent + "0d" } : {}}
          >
            <input
              type="radio"
              name="domain"
              value={d.name}
              checked={selectedDomain === d.name}
              onChange={() => setSelectedDomain(d.name)}
              className="h-3.5 w-3.5 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-zinc-200">{d.name}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                {d.questionCount} question{d.questionCount === 1 ? "" : "s"}{d.limit > 0 ? ` · limit ${d.limit}` : ""}
              </p>
            </div>
          </label>
        ))}
      </div>
    </>
  );

  const renderSlotPicker = () => {
    const dur = assessment.durationMinutes || 0;
    return (
      <>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
          <Clock size={14} style={{ color: accent }} /> Choose a start time
        </p>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
          Pick the slot that suits you. Your assessment ends {dur} minutes after it starts.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {assessment.slots.map((s) => {
            const startMs = new Date(s.startMs).getTime();
            const past = startMs < now;
            const active = selectedSlot === s.start;
            return (
              <button
                key={s.start}
                type="button"
                disabled={past}
                onClick={() => setSelectedSlot(s.start)}
                className="rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                style={active
                  ? { borderColor: accent, backgroundColor: accent + "14", color: accent }
                  : { borderColor: "var(--c-border-light)" }}
              >
                {s.start} – {fmtClock(new Date(startMs + dur * 60000).toISOString())}
                {past && <span className="ml-1 text-[10px]">(passed)</span>}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const renderLobby = () => {
    const dur = assessment.durationMinutes || 0;
    return (
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border p-4 text-center dark:border-zinc-800" style={{ backgroundColor: accent + "08" }}>
          {startsAtMs !== null && now < startsAtMs ? (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-400">Your assessment starts in</p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-zinc-100">
                {renderCountdown(startsAtMs)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Starting at {fmtClock(assessment.startsAt!)}
                {assessment.slotStart ? ` · ends by ${fmtClock(new Date(startsAtMs + dur * 60000).toISOString())}` : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-zinc-100">Opening your paper…</p>
            </>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
          <p className="font-semibold text-slate-700 dark:text-zinc-300">Before you begin</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>{dur} minute{dur === 1 ? "" : "s"} total, counted from your start time.</li>
            <li>Questions appear automatically when the clock reaches zero. Do not close this tab.</li>
            <li>Your answers save automatically as you go, so you may safely resume if you reconnect.</li>
            <li>The assessment submits itself at the deadline. Review and submit any time before then.</li>
          </ul>
        </div>

        {assessment.instructions && (
          <div className="rounded-lg border-l-4 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" style={{ borderColor: accent }}>
            <p className="font-semibold">Note from the hiring team</p>
            <p className="mt-1 whitespace-pre-line">{assessment.instructions}</p>
          </div>
        )}

        {hasDomains && (
          <div className="rounded-lg border border-slate-100 p-3 dark:border-zinc-800">
            <p className="text-xs text-slate-500 dark:text-zinc-400">Your domain</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {selectedDomain || assessment.domain || "Not selected"}
            </p>
          </div>
        )}
        {error && <p className="flex items-center gap-1.5 text-sm text-rose-600"><AlertTriangle size={14} /> {error}</p>}
      </div>
    );
  };

  // 0. Preview result view: preview-only, reached when the dry run has been
  // graded — a real candidate never lands here.
  if (preview && submitted && previewGrade) {
    const answerKeyShown = previewGrade.answerKeyVisible !== false && Boolean(previewGrade.answerKey);
    const releaseNote = isMock
      ? assessment.resultRelease === "immediate"
        ? "This configuration releases results straight after submitting."
        : assessment.resultRelease === "never"
          ? "With this configuration the candidate would never see this result."
          : `With this configuration the candidate would see it about ${assessment.resultDelayHours ?? 0}h after submitting.`
      : assessment.answerKeyPublished
        ? "The answer key is published for the real assessment."
        : "For the real assessment the answer key stays hidden until HR publishes it.";
    return (
      <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
          {isMock ? "Mock Test Preview Complete" : "Assessment Preview Complete"}
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          Dry run only — no candidate record was touched. {releaseNote}
        </p>
        {previewGrade.sample && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Sample questions were used because this job has no questions in its bank yet — this score reflects
            placeholders, not the real paper.
          </p>
        )}
        <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${previewGrade.passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {previewGrade.passed ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {previewGrade.score}/100 — {previewGrade.passed ? "Passed" : "Failed"}
        </div>
        {previewGrade.rawMarks != null && (
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
            {formatMarks(previewGrade.rawMarks)}/{formatMarks(previewGrade.maxMarks ?? 0)} marks · Passing threshold: {previewGrade.passScore ?? assessment.passScore}% · Correct {previewGrade.correct} / Wrong {previewGrade.wrong}
            {previewGrade.hasEssays ? ` · ${previewGrade.essayCount} essay(s) marked for manual review` : ""}
          </p>
        )}
        {previewGrade.answerKeyVisible === false && (
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
            The answer key stays hidden for this setup, exactly as candidates will see it.
          </p>
        )}
        {answerKeyShown && (
          <button
            onClick={() => void handleDownloadAnswerKey()}
            disabled={downloading}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? "Preparing PDF…" : "Download Question Paper & Answer Key"}
          </button>
        )}
      </div>
    );
  }

  // 1. Submitted view
  if (submitted && assessment.submittedAt) {
    // The mock track is never reviewed by a human, so it never has an
    // "under review" state. The server withholds `result` until the release
    // rule is met, so an absent result here genuinely means "not yet".
    if (isMock) {
      const attemptsText =
        assessment.maxAttempts && assessment.maxAttempts > 1
          ? ` Attempt ${assessment.result?.attemptNumber ?? assessment.attemptNumber ?? "—"} of ${assessment.maxAttempts} completed.`
          : "";
      return (
        <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Mock Test Complete</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            Your practice paper has been submitted.{attemptsText} This practice run does not affect your application.
          </p>
          {assessment.resultVisible && assessment.result ? (
            <>
              <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${assessment.result.passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {assessment.result.passed ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {assessment.result.score}/100 — {assessment.result.passed ? "Passed" : "Failed"}
              </div>
              {assessment.result.rawMarks != null && (
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                  {formatMarks(assessment.result.rawMarks)}/{formatMarks(assessment.result.maxMarks ?? 0)} marks · Passing threshold: {assessment.passScore}%
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Clock size={16} />
              {assessment.resultRelease === "never"
                ? "Result not released"
                : `Result available ${assessment.resultVisibleAt ? fmtDay(assessment.resultVisibleAt) : "shortly"}`}
            </p>
          )}
          {assessment.answerKeyVisible && (
            <button
              onClick={() => void handleDownloadAnswerKey()}
              disabled={downloading}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? "Preparing PDF…" : "Download Question Paper & Answer Key"}
            </button>
          )}
        </div>
      );
    }

    const published = Boolean(assessment.resultPublished);
    return (
      <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Online Assessment</h3>
        {!published ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            Your assessment has been submitted and is under review. Results will be shared once evaluated.
          </p>
        ) : assessment.status && assessment.status === "pending" ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            {assessment.score != null ? (
              <>Assessment submitted. Multiple-choice score: {assessment.score}/100{assessment.rawMarks != null ? ` (${formatMarks(assessment.rawMarks)}/${formatMarks(assessment.maxMarks)} marks)` : ""}. Your essay answer(s) will be reviewed manually.</>
            ) : (
              <>Your assessment has been submitted and is under review. Results will be shared once evaluated.</>
            )}
          </p>
        ) : assessment.score != null ? (
          <>
            <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${assessment.status === "selected" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {assessment.status === "selected" ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {assessment.score}/100 — {assessment.status === "selected" ? "Passed" : "Failed"}
            </div>
            {assessment.rawMarks != null && (
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                {formatMarks(assessment.rawMarks)}/{formatMarks(assessment.maxMarks)} marks · Passing threshold: {assessment.passScore}%
              </p>
            )}
            {assessment.startedAt && (
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                {fmtDay(assessment.startedAt)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Your assessment has been submitted. Results are pending.</p>
        )}
        {published && assessment.status === "rejected" && assessment.rejectionNote && (
          <p className="mt-2 text-sm text-slate-500">{assessment.rejectionNote}</p>
        )}
        {published && assessment.answerKeyPublished && (
          <button
            onClick={() => void handleDownloadAnswerKey()}
            disabled={downloading}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? "Preparing PDF…" : "Download Question Paper & Answer Key"}
          </button>
        )}
      </div>
    );
  }

  // 2. Started test view — exam-console style: one question on screen at a
  // time, a numbered palette with statuses, and the Save & Next / Clear
  // Response / Mark for Review action row. The proctoring surfaces (selfie
  // tile, banner, block overlay) stay exactly as they were.
  if (started && questions.length > 0) {
    const formatTime = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    };
    const activeIndex = currentQ < questions.length ? currentQ : 0;
    const activeQ = questions[activeIndex];
    const activeMarked = marked.has(activeIndex);
    const isLastQuestion = activeIndex === questions.length - 1;
    const chipFor = (qi: number) => {
      const q = questions[qi];
      const answered = isAnsweredQuestion(q);
      const isMarked = marked.has(qi);
      const cls = isMarked
        ? "bg-violet-500 text-white"
        : answered
          ? "bg-emerald-600 text-white"
          : visited.has(qi)
            ? "bg-rose-500 text-white"
            : "border border-slate-200 bg-white text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
      return {
        cls,
        answered,
        isMarked,
        style: qi === activeIndex ? { boxShadow: `0 0 0 2px ${accent}` } : undefined,
      };
    };
    // Palette counters follow exam-console semantics: a marked question is
    // counted as marked, with a separate count when it also has an answer.
    const answeredCount = questions.filter((q, qi) => isAnsweredQuestion(q) && !marked.has(qi)).length;
    const markedAnsweredCount = questions.filter((q, qi) => marked.has(qi) && isAnsweredQuestion(q)).length;
    const markedCount = Math.min(marked.size, questions.length) - markedAnsweredCount;
    const notAnsweredCount = questions.filter((q, qi) => !isAnsweredQuestion(q) && !marked.has(qi) && visited.has(qi)).length;
    const notVisitedCount = questions.length - answeredCount - markedAnsweredCount - markedCount - notAnsweredCount;

    return (
      <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
        {preview && previewSample && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              Sample questions: this job&apos;s question bank is empty, so these are placeholders showing how the
              experience works. They are not this job&apos;s questions.
            </span>
          </div>
        )}
        {proctoring.active && <SelfieTile stream={media.stream} micDb={proctoring.peakDb} requireMic={proctoringSettings?.requireMic !== false} micLevel={proctoring.micFraction} />}
        {proctoring.blocked && (
          <ProctoringOverlay
            reason={proctoring.blockedReason}
            remainingMs={remaining !== null ? remaining * 1000 : null}
            violations={proctoring.violations}
            graceCapped={proctoring.graceCapped}
            fullscreenMissing={proctoring.fullscreenMissing ?? false}
            screenShareDetected={proctoring.screenShareDetected}
            busy={restoring}
            onRestore={() => void restoreFullscreen()}
            onRetryCamera={() => void media.retry()}
            onDismissScreenShare={proctoring.dismissScreenShare}
            tone={accent}
          />
        )}
        <div className={`${preview ? "" : "sticky top-[53px] z-10"} -mx-5 -mt-5 flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-[var(--c-border-light)] bg-[var(--c-bg-card)] px-5 py-3 dark:border-zinc-800`}>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">{isMock ? "Mock Test" : "Online Assessment"}</h3>
            {assessment.domain && (
              <p className="mt-0.5 text-xs text-slate-400">
                <Layers size={11} className="mr-1 inline" /> {assessment.domain}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {proctoring.active && (
              <ExtensionRequest
                token={token}
                status={extension.status}
                requestedMs={extension.requestedMs}
                grantedMs={extension.grantedMs}
                disabled={proctoring.blocked}
              />
            )}
            {remaining !== null && remaining > 0 && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-mono font-bold ${remaining < 60 ? "bg-rose-50 text-rose-700 animate-pulse dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
                <Clock size={14} /> {formatTime(remaining)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 dark:text-zinc-500">
          <span>Passing threshold: {assessment.passScore}%</span>
          {assessment.negativeMarking > 0 && <span>Negative marking: -{negativeMarkingShort(assessment.negativeMarking, assessment.negativeMarkingLabel)} per wrong answer</span>}
          {proctoring.active && <span>Proctored — camera on, Microphone on, Screen sharing</span>}
          <span>{preview ? "Preview only — answers are not saved" : "Answers save automatically"}</span>
          {isMock && <span className="font-semibold text-slate-500 dark:text-zinc-400">Practice run — does not affect your application</span>}
          {preview && <span className="font-semibold text-slate-500 dark:text-zinc-400">Preview — nothing is recorded</span>}
        </div>
        {proctoring.active && (
          <div className="mt-3">
            <ProctoringBanner
              noiseWarnings={proctoring.noiseWarnings}
              noiseWarningsLeft={proctoring.noiseWarningsLeft}
              noiseThresholdDb={proctoringSettings?.noiseThresholdDb ?? -35}
              peakDb={proctoring.peakDb}
              multiFaceWarning={proctoring.multiFaceWarning}
              faceMode={proctoring.faceMode}
              fullscreenMissing={proctoring.fullscreenMissing}
              fullscreenSupported={proctoring.fullscreenSupported}
              onRestore={() => void restoreFullscreen()}
              onDismissFace={proctoring.dismissFaceWarning}
            />
          </div>
        )}
        {!inExamWindow && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={14} className="shrink-0" />
            Time is up — your saved answers are being submitted.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Question area — one question at a time */}
          <section className="min-w-0 flex-1">
            <div
              ref={questionCardRef}
              className="rounded-lg border border-[var(--c-border-light)] p-4 dark:border-zinc-800 sm:p-5"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-slate-200 pb-3 dark:border-zinc-700">
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Question {activeIndex + 1}
                  <span className="ml-1 font-normal text-slate-400 dark:text-zinc-500">of {questions.length}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                    +{activeQ.marks || 1}
                  </span>
                  {assessment.negativeMarking > 0 && (
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                      -{negativeMarkingShort(assessment.negativeMarking, assessment.negativeMarkingLabel)}
                    </span>
                  )}
                  {activeQ.required ? (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">Required</span>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">Optional</span>
                  )}
                  {activeMarked && (
                    <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      Marked for review
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-900 dark:text-zinc-100">
                {activeQ.text}
                {activeQ.required && <span className="ml-1 text-rose-500">*</span>}
              </p>

              {activeQ.type === "essay" ? (
                <textarea
                  rows={5}
                  value={answers[activeQ.index]?.textAnswer ?? ""}
                  onChange={(e) => setTextAnswer(activeQ.index, e.target.value)}
                  placeholder="Type your answer here..."
                  className="mt-3 w-full rounded-lg border border-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
                />
              ) : (
                <div className="mt-3 space-y-2">
                  {activeQ.options.map((opt, oi) => {
                    const selected = answers[activeQ.index]?.selectedOption === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setAnswer(activeQ.index, oi)}
                        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          selected
                            ? ""
                            : "border-slate-100 hover:bg-[var(--c-bg-muted)] dark:border-zinc-800"
                        }`}
                        style={selected ? { borderColor: accent, backgroundColor: accent + "14" } : undefined}
                      >
                        <span
                          aria-hidden
                          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${
                            selected
                              ? "border-transparent text-white"
                              : "border-slate-300 text-slate-500 dark:border-zinc-600 dark:text-zinc-400"
                          }`}
                          style={selected ? { backgroundColor: accent } : undefined}
                        >
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-zinc-300">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Exam action row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearCurrentResponse}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border-light)] px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] dark:border-zinc-800 dark:text-zinc-300"
              >
                <Eraser size={14} /> Clear Response
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleMarkCurrent();
                  if (activeIndex < questions.length - 1) goToQuestion(activeIndex + 1);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  activeMarked
                    ? "bg-violet-500 text-white hover:bg-violet-600"
                    : "border border-violet-300 text-violet-600 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
                }`}
              >
                <Flag size={14} />{" "}
                {activeMarked
                  ? isLastQuestion
                    ? "Unmark"
                    : "Unmark & Next"
                  : isLastQuestion
                    ? "Mark for Review"
                    : "Mark for Review & Next"}
              </button>
              <span className="hidden flex-1 sm:block" />
              <button
                type="button"
                onClick={() => goToQuestion(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border-light)] px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                onClick={() => goToQuestion(activeIndex + 1)}
                disabled={isLastQuestion}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                Save &amp; Next <ChevronRight size={14} />
              </button>
            </div>
            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-600"><AlertTriangle size={14} /> {error}</p>
            )}
          </section>

          {/* Question palette */}
          <aside className="order-first shrink-0 rounded-lg border border-[var(--c-border-light)] bg-[var(--c-bg-card)] p-3 dark:border-zinc-800 lg:order-none lg:w-[268px]">
            <p className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Question Palette
              <span className="font-mono text-[11px] font-semibold normal-case">{answeredCount + markedAnsweredCount}/{questions.length}</span>
            </p>
            <div className="mt-2.5 grid grid-cols-8 gap-1.5 lg:grid-cols-6">
              {questions.map((q, qi) => {
                const chip = chipFor(qi);
                return (
                  <button
                    key={q.index}
                    type="button"
                    onClick={() => goToQuestion(qi)}
                    title={`Question ${qi + 1}`}
                    aria-current={qi === activeIndex ? "true" : undefined}
                    className={`relative grid h-8 w-full place-items-center rounded-md text-xs font-bold transition-colors ${chip.cls}`}
                    style={chip.style}
                  >
                    {qi + 1}
                    {chip.isMarked && chip.answered && (
                      <span
                        aria-hidden
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-zinc-900"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <ul className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Answered — {answeredCount}</li>
              <li className="flex items-center gap-2">
                <span className="relative h-2.5 w-2.5 rounded-sm bg-violet-500">
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-zinc-900" />
                </span>
                Answered &amp; marked — {markedAnsweredCount}
              </li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Marked, not answered — {markedCount}</li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Not answered — {notAnsweredCount}</li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-zinc-600" /> Not visited — {notVisitedCount}</li>
            </ul>
            <button
              type="button"
              onClick={() => void handleSubmitClick()}
              disabled={submitting}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? "Submitting…" : preview ? "Grade Preview" : isMock ? "Submit Mock Test" : "Submit Assessment"}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-zinc-500">
              {remaining !== null && remaining > 0
                ? "The paper submits itself at zero on the clock."
                : "Time is up — submission is in progress."}
            </p>
          </aside>
        </div>
      </div>
    );
  }

  // 3. Preflight: the device check a proctored sitting must pass first.
  if (preflight && !submitted) {
    return (
      <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
        <ProctoringPreflight
          stream={media.stream}
          micDb={preflightMic.db}
          micSupported={preflightMic.supported}
          requireCamera={proctoringSettings?.requireCamera !== false}
          requireMic={proctoringSettings?.requireMic !== false}
          requireFullscreen={proctoringSettings?.requireFullscreen !== false}
          fullscreenSupported={proctoring.fullscreenSupported}
          noiseThresholdDb={proctoringSettings?.noiseThresholdDb ?? -35}
          noiseWarningLimit={proctoringSettings?.noiseWarningLimit ?? 3}
          status={media.status}
          error={media.error}
          ready={proctorReady}
          busy={beginBusy}
          onRetry={() => void media.retry()}
          onBegin={() => void beginProctoredAssessment()}
          tone={accent}
        />
        {error && <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-600"><AlertTriangle size={14} /> {error}</p>}
        {popupBlockedLink}
      </div>
    );
  }

  // 4. Pre-exam view: closed, waiting room, or expired
  return (
    <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">{isMock ? "Mock Test" : "Online Assessment"}</h3>
      {preview && (
        <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Preview — nothing is saved, submitted or emailed. This is what the candidate will see.
        </p>
      )}
      {assessment.enabled && (
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          {scheduleText ? `${scheduleText} · ` : ""}{assessment.durationMinutes ? `${assessment.durationMinutes} min time limit · ` : ""}Passing threshold {assessment.passScore}%
        </p>
      )}
      {preflightWanted && (
        <p className="mt-1.5 text-xs text-slate-400 dark:text-zinc-500">
          Proctored: the camera and microphone stay on, and the exam opens fullscreen, and the system checks for multiple faces, screen sharing, and background noise.
        </p>
      )}

      {isExpired ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            The window to start this {isMock ? "mock test" : "assessment"} has closed{assessment.endsAt ? ` — your time ended at ${fmtClock(assessment.endsAt)}` : ""}.
            {!isMock && assessment.stage === "assessment" && " Your saved answers are still available if you contacted the hiring team."}
          </span>
        </p>
      ) : inLobby ? (
        renderLobby()
      ) : (
        <>
          {isClosed && <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">{closedMessage()}</p>}
          {/* Why the start button is off — one silver block per server state. */}
          {mockExhausted && !isClosed && (
            <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
              You have used {assessment.attemptsUsed} of {assessment.maxAttempts} attempt{(assessment.maxAttempts ?? 0) > 1 ? "s" : ""} for this mock test
              {assessment.submittedAt ? `, most recently on ${fmtDay(assessment.submittedAt)} at ${fmtClock(assessment.submittedAt)}` : ""}. Contact the hiring team if you need another.
            </p>
          )}
          {/* A real attempt is on the clock: offer an immediate way back into it. */}
          {mockResumable && (
            <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
              Attempt {assessment.attemptNumber ?? 1} of {assessment.maxAttempts ?? 1} is still running
              {examEndsAtMs ? " — " : ""}{examEndsAtMs ? renderCountdown(examEndsAtMs) : null}{assessment.endsAt ? " left on the clock." : "."} Press resume to go back in.
            </p>
          )}
          {awaitingStage && !submitted && (
            <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
              The {isMock ? "mock test" : "assessment"} unlocks once your application reaches the Screening stage.
            </p>
          )}
          {hasDomains && !submitted && <div className="mt-4">{renderDomainPicker()}</div>}
          {assessment.windowMode === "uniform" && assessment.slots.length > 0 && !submitted && (
            <div className="mt-4">{renderSlotPicker()}</div>
          )}
          {(assessment.eligibleToStart || mockResumable) && (
            <button
              onClick={() => {
                if (preflightWanted) {
                  setPreflight(true);
                  setProctorReady(false);
                  void media.acquire();
                  return;
                }
                void handleStart();
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <PlayCircle size={16} />
              {assessment.phase === "lobby" && !isMock
                ? "Enter Waiting Room"
                : preflightWanted
                  ? "Check camera and start"
                  : isMock
                    ? mockResumable && !assessment.eligibleToStart
                      ? "Resume Mock Test"
                      : "Start Mock Test"
                    : "Start Assessment"}
            </button>
          )}
        </>
      )}
      {error && <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-600"><AlertTriangle size={14} /> {error}</p>}
      {popupBlockedLink}
    </div>
  );
}