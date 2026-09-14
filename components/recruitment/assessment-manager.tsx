"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, FileText, PenLine, ArrowLeft, Loader2, Upload } from "lucide-react";

type Question = {
  text: string;
  options: string[];
  correctIndex: number;
  type: "mcq" | "essay";
  answer: string;
};

function baseQuestion(): Question {
  return { text: "", options: ["", "", "", ""], correctIndex: 0, type: "mcq", answer: "" };
}

export function AssessmentManagerModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [passScore, setPassScore] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState<"menu" | "manual" | "pdf-upload" | "pdf-review">("menu");
  const [pdfQuestions, setPdfQuestions] = useState<Question[]>([]);
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const [pdfError, setPdfError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    fetch(`/api/recruitment/jobs/${jobId}/assessment`)
      .then((r) => r.json())
      .then((data) => {
        if (data.assessment) {
          setPassScore(data.assessment.passScore ?? 50);
          const saved = data.assessment.questions?.length ? data.assessment.questions : [];
          setQuestions(
            saved.map((q: any) => ({
              text: q.text ?? "",
              options: Array.isArray(q.options) ? q.options : [],
              correctIndex: q.correctIndex ?? 0,
              type: q.type === "essay" ? "essay" : "mcq",
              answer: q.answer ?? "",
            }))
          );
        }
        if (typeof data.job?.assessmentDurationMinutes === "number") {
          setDurationMinutes(data.job.assessmentDurationMinutes);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [jobId]);

  function addQuestion() {
    setQuestions([...questions, baseQuestion()]);
  }

  function removeQuestion(idx: number, list: Question[], setList: (v: Question[]) => void) {
    setList(list.filter((_, i) => i !== idx));
  }

  function validate(list: Question[]): string {
    if (!list.length) return "Add at least one question.";
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!q.text.trim()) return `Question ${i + 1} needs text.`;
      if (q.type === "mcq") {
        const nonEmpty = q.options.map((o) => o.trim()).filter(Boolean);
        if (nonEmpty.length < 2) return `Question ${i + 1} needs at least 2 options.`;
      }
    }
    return "";
  }

  function buildPayload(list: Question[]) {
    return list.map((q) => {
      const type = q.type === "essay" ? "essay" : "mcq";
      if (type === "essay") {
        return { text: q.text, options: [], correctIndex: 0, type, answer: q.answer ?? "" };
      }
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      const correctIndex = Math.max(0, Math.min(options.length - 1, q.correctIndex || 0));
      return { text: q.text, options, correctIndex, type, answer: "" };
    });
  }

  async function handleSave(list: Question[] = questions) {
    if (savingRef.current) return;
    const err = validate(list);
    if (err) { setError(err); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passScore, durationMinutes, questions: buildPayload(list) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string })?.error || `Server error (${res.status}).`);
      setSuccess("Assessment saved successfully.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleUploadPdf(file: File) {
    setPdfError("");
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment/parse-pdf`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!data) throw new Error(res.ok ? "Empty response from server." : `Server error (${res.status}).`);
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Failed to parse PDF.");
      const parsed: Question[] = (data.questions || []).map((q: any) => ({
        text: q.text ?? "",
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: q.correctIndex ?? 0,
        type: q.type === "essay" ? "essay" : "mcq",
        answer: q.answer ?? "",
      }));
      setPdfQuestions(parsed);
      setPdfWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setStep("pdf-review");
    } catch (e: any) {
      setPdfError(e.message);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePdfConfirm() {
    setQuestions(pdfQuestions);
    await handleSave(pdfQuestions);
    if (validate(pdfQuestions)) return;
    setStep("manual");
  }

  const renderQuestionCard = (q: Question, idx: number, editable: boolean, list: Question[], setList: (v: Question[]) => void) => (
    <div key={idx} className={`rounded-lg border p-4 dark:border-zinc-800 ${q.type === "essay" ? "border-violet-200 bg-violet-50/40 dark:border-violet-900/40" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Question {idx + 1}</span>
          <textarea
            value={q.text}
            onChange={(e) => { const next = [...list]; next[idx] = { ...q, text: e.target.value }; setList(next); }}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
            placeholder="Enter question text..."
          />
        </label>
        {editable && (
          <button onClick={() => removeQuestion(idx, list, setList)} className="mt-4 shrink-0 rounded p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => { const next = [...list]; next[idx] = { ...q, type: "mcq", options: q.options.length >= 2 ? q.options : ["", "", "", ""], correctIndex: q.correctIndex }; setList(next); }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${q.type === "mcq" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
        >
          Multiple choice
        </button>
        <button
          type="button"
          onClick={() => { const next = [...list]; next[idx] = { ...q, type: "essay", options: [], correctIndex: 0 }; setList(next); }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${q.type === "essay" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
        >
          Essay
        </button>
      </div>

      {q.type === "mcq" ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {q.options.map((opt, oi) => (
              <label key={oi} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-zinc-800">
                <input type="radio" name={`correct-${idx}`} checked={q.correctIndex === oi} onChange={(e) => { if (e.target.checked) { const next = [...list]; next[idx] = { ...q, correctIndex: oi }; setList(next); } }} className="h-3 w-3" title="Mark as correct answer" />
                <span className="w-4 shrink-0 text-xs font-semibold text-slate-400">{String.fromCharCode(65 + oi)}</span>
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...list];
                    const opts = [...next[idx].options];
                    opts[oi] = e.target.value;
                    next[idx] = { ...next[idx], options: opts };
                    setList(next);
                  }}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                />
                {q.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...list];
                      const opts = next[idx].options.filter((_, i) => i !== oi);
                      const q2 = { ...next[idx], options: opts };
                      if (q2.correctIndex > opts.length - 1) q2.correctIndex = Math.max(0, opts.length - 1);
                      next[idx] = q2;
                      setList(next);
                    }}
                    className="rounded p-0.5 text-rose-400 hover:bg-rose-50"
                    title="Remove option"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => { const next = [...list]; next[idx] = { ...next[idx], options: [...next[idx].options, ""] }; setList(next); }} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400">
            <Plus size={12} /> Add option
          </button>
        </>
      ) : (
        <div className="mt-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Expected answer / message</span>
            <textarea
              value={q.answer ?? ""}
              onChange={(e) => { const next = [...list]; next[idx] = { ...q, answer: e.target.value }; setList(next); }}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
              placeholder="Candidates will type a free-form essay. Save the expected answer or grading hints here for manual review."
            />
          </label>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
        <div className="w-full max-w-3xl rounded-lg bg-white shadow-soft dark:bg-[#000000] p-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-soft dark:bg-[#000000]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          {step !== "menu" ? (
            <button onClick={() => setStep("menu")} className="flex items-center gap-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700">
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Manage Assessment</h2>
          )}
          <div className="flex items-center gap-2">
            {step !== "menu" && <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Manage Assessment</h2>}
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="max-h-[78vh] space-y-4 overflow-y-auto p-5">
          {step === "menu" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Passing Score (%)</span>
                  <input type="number" min="0" max="100" value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Duration (minutes)</span>
                  <input type="number" min="1" max="600" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" placeholder="e.g. 60" />
                </label>
              </div>

              <p className="text-sm text-slate-600 dark:text-zinc-300">How do you want to add the questions?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setStep("pdf-upload")}
                  className="group rounded-lg border border-slate-200 p-5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-zinc-800 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <FileText size={20} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-zinc-100">Upload PDF</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Parse pre-written questions, options and answers from a PDF. You review them before saving.
                  </p>
                </button>
                <button
                  onClick={() => setStep("manual")}
                  className="group rounded-lg border border-slate-200 p-5 text-left transition hover:border-emerald-400 hover:bg-slate-50 dark:border-zinc-800 dark:hover:border-emerald-500/50 dark:hover:bg-zinc-900"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <PenLine size={20} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-zinc-100">Manual questions</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Type your questions one by one. Supports multiple choice and essay questions.
                  </p>
                </button>
              </div>

              {questions.length > 0 && (
                <p className="text-xs text-slate-400">
                  {questions.length} question{questions.length === 1 ? " is" : "s are"} currently saved for this assessment.
                </p>
              )}
            </>
          )}

          {step === "pdf-upload" && (
            <>
              <p className="text-sm text-slate-600 dark:text-zinc-300">Upload a PDF containing questions with options and their answers.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                disabled={parsing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadPdf(file);
                }}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
              />
              {parsing && (
                <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 size={14} className="animate-spin" /> Parsing questions...
                </p>
              )}
              {pdfError && <p className="text-sm text-rose-600">{pdfError}</p>}
            </>
          )}

          {step === "pdf-review" && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Review parsed questions</h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {pdfQuestions.length} detected
                </span>
              </div>
              {pdfWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <p className="font-semibold">Review these before saving:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {pdfWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Edit anything below if the parse needs changes, then confirm. Your existing questions will be replaced.
              </p>
              <div className="space-y-4">
                {pdfQuestions.map((q, qi) => renderQuestionCard(q, qi, true, pdfQuestions, setPdfQuestions))}
              </div>
            </>
          )}

          {step === "manual" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Passing Score (%)</span>
                  <input type="number" min="0" max="100" value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Duration (minutes)</span>
                  <input type="number" min="1" max="600" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" placeholder="e.g. 60" />
                </label>
              </div>

              <div className="space-y-4">
                {questions.map((q, qi) => renderQuestionCard(q, qi, true, questions, setQuestions))}
              </div>

              <button onClick={addQuestion} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400">
                <Plus size={14} /> Add Question
              </button>
            </>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-2 dark:border-zinc-800">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">Cancel</button>
            {(step === "manual") && (
              <button onClick={() => handleSave()} disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200">
                {saving ? "Saving..." : "Save Assessment"}
              </button>
            )}
            {step === "pdf-review" && (
              <>
                <button onClick={() => setStep("pdf-upload")} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
                  Upload another
                </button>
                <button onClick={() => void handlePdfConfirm()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {saving ? "Saving..." : "Confirm & Save"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}