"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Question = { text: string; options: string[]; correctIndex: number };

export function AssessmentManagerModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [passScore, setPassScore] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch(`/api/recruitment/jobs/${jobId}/assessment`)
      .then((r) => r.json())
      .then((data) => {
        if (data.assessment) {
          setPassScore(data.assessment.passScore ?? 50);
          setQuestions(data.assessment.questions?.length ? data.assessment.questions : []);
        }
        if (typeof data.job?.assessmentDurationMinutes === "number") {
          setDurationMinutes(data.job.assessmentDurationMinutes);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [jobId]);

  function addQuestion() {
    setQuestions([...questions, { text: "", options: ["", "", "", ""], correctIndex: 0 }]);
  }

  function updateQuestion(idx: number, field: keyof Question, value: any) {
    const next = [...questions];
    (next[idx] as any)[field] = value;
    setQuestions(next);
  }

  function updateOption(qIdx: number, oIdx: number, value: string) {
    const next = [...questions];
    const opts = [...next[qIdx].options];
    opts[oIdx] = value;
    next[qIdx] = { ...next[qIdx], options: opts };
    setQuestions(next);
  }

  function removeQuestion(idx: number) {
    setQuestions(questions.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!questions.length) { setError("Add at least one question."); return; }
    if (questions.some((q) => !q.text.trim())) { setError("All questions need text."); return; }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passScore, durationMinutes, questions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setSuccess("Assessment saved successfully.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
        <div className="w-full max-w-lg rounded-lg bg-white shadow-soft dark:bg-[#000000] p-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-soft dark:bg-[#000000]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Manage Assessment</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="space-y-4 p-5 max-h-[70vh] overflow-y-auto">
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
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-lg border border-slate-200 p-4 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-2">
                  <label className="flex-1">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Question {qi + 1}</span>
                    <textarea value={q.text} onChange={(e) => updateQuestion(qi, "text", e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" placeholder="Enter question text..." />
                  </label>
                  <button onClick={() => removeQuestion(qi)} className="mt-4 shrink-0 rounded p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-zinc-800">
                      <input type="radio" name={`correct-${qi}`} checked={q.correctIndex === oi} onChange={() => updateQuestion(qi, "correctIndex", oi)} className="h-3 w-3" />
                      <input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder={`Option ${oi + 1}`} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={addQuestion} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400">
            <Plus size={14} /> Add Question
          </button>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200">
              {saving ? "Saving..." : "Save Assessment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}