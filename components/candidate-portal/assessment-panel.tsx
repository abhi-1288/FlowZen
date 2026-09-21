"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PlayCircle, Clock, Send, CheckCircle, XCircle, Layers, AlertTriangle, Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";

type Question = { index: number; text: string; options: string[]; type?: "mcq" | "essay"; marks?: number; required?: boolean };

type Props = {
  token: string;
  assessment: {
    enabled: boolean;
    date: string | null;
    durationMinutes: number | null;
    passScore: number;
    negativeMarking: number;
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
  };
  accent: string;
  companyName?: string;
  onRefresh: () => void;
  /** When true, auto-starts the assessment on mount (used in test tab). */
  autoStart?: boolean;
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
    `Score: ${data.score != null ? `${data.score}/100` : "—"}${data.rawMarks != null ? `  (${data.rawMarks}/${data.maxMarks} marks)` : ""}  ·  Passing threshold: ${data.passScore}%`,
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
    doc.text(`Negative marking: -${data.negativeMarking} per wrong answer`, margin, y);
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
  doc.text(data.negativeMarking > 0 ? `-${data.negativeMarking} marks penalty` : "no marks", margin + 230, y + 26);
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
      resultText = data.negativeMarking > 0 ? `— Wrong  -${data.negativeMarking} marks` : "— Wrong (no marks)";
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

export function AssessmentPanel({ token, assessment, accent, companyName, onRefresh, autoStart }: Props) {
  const [started, setStarted] = useState(assessment.submittable);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, { selectedOption?: number; textAnswer?: string }>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(assessment.submittedAt));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(assessment.domain || "");
  const [downloading, setDownloading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);
  const autoSubmitRef = useRef<() => void>(() => {});
  const autoStartRef = useRef(false);

  // Compute initial remaining
  useEffect(() => {
    if (started && assessment.endsAt && !submitted) {
      const endMs = new Date(assessment.endsAt).getTime();
      const diff = Math.max(0, endMs - Date.now());
      setRemaining(Math.floor(diff / 1000));
    }
  }, [started, assessment.endsAt, submitted]);

  const doSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError("");
    try {
      const answerArray = questions.map((q) => ({
        questionIndex: q.index,
        selectedOption: answers[q.index]?.selectedOption,
        ...(q.type === "essay" ? { textAnswer: answers[q.index]?.textAnswer ?? "" } : {}),
      }));
      const res = await fetch(`/api/public/candidate/me/assessment/submit?token=${encodeURIComponent(token)}`, {
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
  }, [answers, questions, submitted, submitting, token, onRefresh]);

  const autoSubmit = useCallback(async () => {
    if (autoSubmittedRef.current || submitting || submitted) return;
    autoSubmittedRef.current = true;
    await doSubmit();
  }, [doSubmit, submitting, submitted]);

  // Keep ref always pointing to the latest autoSubmit
  useEffect(() => {
    autoSubmitRef.current = autoSubmit;
  }, [autoSubmit]);

  // Countdown
  useEffect(() => {
    if (remaining === null || remaining <= 0 || submitted) return;
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [remaining !== null && remaining > 0 && !submitted]);

  // Auto-submit when timer hits zero
  useEffect(() => {
    if (remaining === 0 && !submitted && !autoSubmittedRef.current) {
      autoSubmitRef.current();
    }
  }, [remaining, submitted]);

  // Auto-start when test tab opens (only fires once)
  useEffect(() => {
    if (!autoStart || autoStartRef.current) return;
    autoStartRef.current = true;

    // If already started (re-open), restore from localStorage
    // If started but no cached questions, fetch them from the start API
    if (started) {
      try {
        const stored = localStorage.getItem(`ap-${token}`);
        if (stored) {
          const { q, e } = JSON.parse(stored);
          if (Array.isArray(q) && q.length > 0) {
            setQuestions(q);
            if (e) setRemaining(Math.max(0, Math.floor((new Date(e).getTime() - Date.now()) / 1000)));
            return;
          }
        }
      } catch {}
      void handleStart();
      return;
    }

    if (submitted || !assessment.eligibleToStart) return;

    // When a domain must be selected manually, let the user pick it first
    if (assessment.domains?.length && !assessment.domain) return;

    // Check localStorage for previously stored questions
    try {
      const stored = localStorage.getItem(`ap-${token}`);
      if (stored) {
        const { q, e } = JSON.parse(stored);
        if (Array.isArray(q) && q.length > 0) {
          setQuestions(q);
          setStarted(true);
          if (e) setRemaining(Math.max(0, Math.floor((new Date(e).getTime() - Date.now()) / 1000)));
          return;
        }
      }
    } catch {}

    void handleStart();
  }, [autoStart]);

  async function handleStart() {
    setError("");
    if (assessment.domains?.length && !selectedDomain && !assessment.domain) {
      setError("Please select your domain to start the assessment.");
      return;
    }

    // Normal mode: open the test in a new tab
    if (!autoStart) {
      window.open(`/candidate-portal?token=${encodeURIComponent(token)}&test=true`, "_blank");
      return;
    }

    // Auto-start mode (new tab): call the start API directly
    try {
      const res = await fetch(`/api/public/candidate/me/assessment/start?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: assessment.domain || selectedDomain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start.");
      setQuestions(data.questions);
      setStarted(true);
      onRefresh();
      try { localStorage.setItem(`ap-${token}`, JSON.stringify({ q: data.questions, e: data.endsAt, d: data.domain })); } catch {}
    } catch (e: any) {
      setError(e.message);
    }
  }

  function setAnswer(qIndex: number, selectedOption: number) {
    setAnswers((prev) => ({ ...prev, [qIndex]: { ...prev[qIndex], selectedOption } }));
  }

  function setTextAnswer(qIndex: number, textAnswer: string) {
    setAnswers((prev) => ({ ...prev, [qIndex]: { ...prev[qIndex], textAnswer } }));
  }

  async function handleSubmitClick() {
    const missing = questions
      .filter((q) => q.required)
      .filter((q) => {
        const a = answers[q.index];
        return q.type === "essay"
          ? !(a && String(a.textAnswer || "").trim())
          : a == null || typeof a.selectedOption !== "number";
      })
      .map((q) => q.index + 1);
    if (missing.length) {
      setError(`Please answer the required question${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
      return;
    }
    await doSubmit();
  }

  async function handleDownloadAnswerKey() {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/candidate/me/assessment/answer-key?token=${encodeURIComponent(token)}`);
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
  const accentSoft = accent + "1a"; // simple alpha
  const fmtDate = assessment.date ? new Date(assessment.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const fmtTime = assessment.date ? new Date(assessment.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC" }) : "";
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const hasDomains = Array.isArray(assessment.domains) && assessment.domains.length > 0;

  // 1. Submitted view
  if (submitted && assessment.submittedAt) {
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
              <>Assessment submitted. Multiple-choice score: {assessment.score}/100{assessment.rawMarks != null ? ` (${assessment.rawMarks}/${assessment.maxMarks} marks)` : ""}. Your essay answer(s) will be reviewed manually.</>
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
                {assessment.rawMarks}/{assessment.maxMarks} marks · Passing threshold: {assessment.passScore}%
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

  // 2. Started test view
  if (started && questions.length > 0) {
    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    return (
      <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Online Assessment</h3>
            {assessment.domain && (
              <p className="mt-0.5 text-xs text-slate-400">
                <Layers size={11} className="mr-1 inline" /> {assessment.domain}
              </p>
            )}
          </div>
          {remaining !== null && remaining > 0 && (
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-mono font-bold ${remaining < 60 ? "bg-rose-50 text-rose-700 animate-pulse" : "bg-amber-50 text-amber-700"}`}>
              <Clock size={14} /> {formatTime(remaining)}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 dark:text-zinc-500">
          <span>Passing threshold: {assessment.passScore}%</span>
          {assessment.negativeMarking > 0 && <span>Negative marking: -{assessment.negativeMarking} per wrong answer</span>}
        </div>
        <div className="mt-4 space-y-4">
          {questions.map((q, qi) => (
            <div key={q.index} className="rounded-lg border border-slate-100 dark:border-zinc-800 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{qi + 1}. {q.text}{q.required && <span className="ml-1 text-rose-500">*</span>}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                    +{q.marks || 1}
                  </span>
                  {q.required ? (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">Required</span>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">Optional</span>
                  )}
                </div>
              </div>
              {q.type === "essay" ? (
                <textarea
                  rows={4}
                  value={answers[q.index]?.textAnswer ?? ""}
                  onChange={(e) => setTextAnswer(q.index, e.target.value)}
                  placeholder="Type your answer here..."
                  className="mt-2 w-full rounded-lg border border-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900"
                />
              ) : (
                <div className="mt-2 space-y-2">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-100 px-3 py-2 hover:bg-[var(--c-bg-muted)] dark:border-zinc-800">
                      <input type="radio" name={`q-${q.index}`} checked={answers[q.index]?.selectedOption === oi} onChange={() => setAnswer(q.index, oi)} className="h-3 w-3" />
                      <span className="text-sm text-slate-700 dark:text-zinc-300">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {error && <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-600"><AlertTriangle size={14} /> {error}</p>}
        <button onClick={() => void handleSubmitClick()} disabled={submitting} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: accent }}>
          <Send size={14} /> {submitting ? "Submitting..." : "Submit Assessment"}
        </button>
      </div>
    );
  }

  // 3. Ready to start view
  return (
    <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Online Assessment</h3>
      {assessment.enabled && (
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          {fmtDate}{fmtTime ? ` · ${fmtTime}` : ""}{assessment.durationMinutes ? ` · ${assessment.durationMinutes} min time limit` : ""} · Passing threshold {assessment.passScore}%
        </p>
      )}

      {hasDomains && !submitted && (
        <div className="mt-4">
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
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition dark:border-zinc-800 ${selectedDomain === d.name ? "ring-1" : "border-[var(--c-border-light)]"}`}
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
        </div>
      )}

      {assessment.eligibleToStart && (
        <button onClick={() => void handleStart()} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: accent }}>
          <PlayCircle size={16} /> Start Assessment
        </button>
      )}
      {!assessment.eligibleToStart && !submitted && assessment.enabled && assessment.date && (
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          Assessment available on {fmtDate}{fmtTime ? ` at ${fmtTime}` : ""}.
        </p>
      )}
      {error && <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-600"><AlertTriangle size={14} /> {error}</p>}
    </div>
  );
}