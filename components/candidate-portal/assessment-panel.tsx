"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PlayCircle, Clock, Send, CheckCircle, XCircle } from "lucide-react";

type Question = { index: number; text: string; options: string[]; type?: "mcq" | "essay" };

type Props = {
  token: string;
  assessment: {
    enabled: boolean;
    date: string | null;
    durationMinutes: number | null;
    stage: string;
    startedAt: string | null;
    submittedAt: string | null;
    score: number | null;
    status: string;
    eligibleToStart: boolean;
    submittable: boolean;
    endsAt: string | null;
  };
  accent: string;
  onRefresh: () => void;
};

export function AssessmentPanel({ token, assessment, accent, onRefresh }: Props) {
  const [started, setStarted] = useState(assessment.submittable);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, { selectedOption?: number; textAnswer?: string }>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(assessment.submittedAt));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);
  const autoSubmitRef = useRef<() => void>(() => {});

  // Compute initial remaining
  useEffect(() => {
    if (started && assessment.endsAt && !submitted) {
      const endMs = new Date(assessment.endsAt).getTime();
      const diff = Math.max(0, endMs - Date.now());
      setRemaining(Math.floor(diff / 1000));
    }
  }, [started, assessment.endsAt, submitted]);

  const autoSubmit = useCallback(async () => {
    if (autoSubmittedRef.current || submitting || submitted) return;
    autoSubmittedRef.current = true;
    await doSubmit();
  }, [answers, questions, submitted, submitting]);

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

  async function handleStart() {
    try {
      const res = await fetch(`/api/public/candidate/me/assessment/start?token=${encodeURIComponent(token)}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start.");
      setQuestions(data.questions);
      setStarted(true);
      onRefresh();
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

  async function doSubmit() {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const answerArray = questions.map((q) => ({
        questionIndex: q.index,
        selectedOption: answers[q.index]?.selectedOption ?? 0,
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
  }

  // ─── Render ────────────────────────────────────────────────
  const accentSoft = accent + "1a"; // simple alpha
  const fmtDate = assessment.date ? new Date(assessment.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

  // 1. Submitted view
  if (submitted && assessment.submittedAt) {
    return (
      <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Online Assessment</h3>
        {assessment.status && assessment.status === "pending" ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            {assessment.score != null ? (
              <>Assessment submitted. Multiple-choice score: {assessment.score}/100. Your essay answer(s) will be reviewed manually.</>
            ) : (
              <>Your assessment has been submitted and is under review. Results will be shared once evaluated.</>
            )}
          </p>
        ) : assessment.score != null ? (
          <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${assessment.status === "selected" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {assessment.status === "selected" ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {assessment.score}/100 — {assessment.status === "selected" ? "Passed" : "Failed"}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Your assessment has been submitted. Results are pending.</p>
        )}
      </div>
    );
  }

  // 2. Started test view
  if (started && questions.length > 0) {
    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    return (
      <div className="rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Online Assessment</h3>
          {remaining !== null && remaining > 0 && (
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-mono font-bold ${remaining < 60 ? "bg-rose-50 text-rose-700 animate-pulse" : "bg-amber-50 text-amber-700"}`}>
              <Clock size={14} /> {formatTime(remaining)}
            </span>
          )}
        </div>
        <div className="mt-4 space-y-4">
          {questions.map((q, qi) => (
            <div key={q.index} className="rounded-lg border border-slate-100 dark:border-zinc-800 p-4">
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{qi + 1}. {q.text}</p>
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
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button onClick={() => doSubmit()} disabled={submitting} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: accent }}>
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
          {fmtDate}{assessment.durationMinutes ? ` · ${assessment.durationMinutes} min time limit` : ""}
        </p>
      )}
      {assessment.eligibleToStart && (
        <button onClick={handleStart} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: accent }}>
          <PlayCircle size={16} /> Start Assessment
        </button>
      )}
      {!assessment.eligibleToStart && !submitted && assessment.enabled && assessment.date && (
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          Assessment available on {fmtDate}.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}