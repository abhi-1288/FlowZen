"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, FileText, PenLine, ArrowLeft, Loader2, Upload } from "lucide-react";

type Question = {
  text: string;
  options: string[];
  correctIndex: number;
  type: "mcq" | "essay";
  answer: string;
  marks: number;
  required: boolean;
  section?: string;
};

type DomainSection = {
  id: string;
  name: string;
  limit: number;
  questions: Question[];
};

type WindowMode = "uniform" | "relief";

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "16:00" + 60 min -> "5:00 PM", so HR can see each slot's fixed end. */
function formatSlotEnd(start: string, durationMinutes: number): string {
  const match = TIME_RE.exec(start);
  if (!match) return "—";
  const total = Number(match[1]) * 60 + Number(match[2]) + (Number(durationMinutes) || 0);
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function baseQuestion(): Question {
  return { text: "", options: ["", "", "", ""], correctIndex: 0, type: "mcq", answer: "", marks: 1, required: false };
}

function baseDomain(id: string): DomainSection {
  return { id, name: "", limit: 0, questions: [] };
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function normalizeQuestion(q: any): Question {
  return {
    text: q?.text ?? "",
    options: Array.isArray(q?.options) ? q.options : [],
    correctIndex: q?.correctIndex ?? 0,
    type: q?.type === "essay" ? "essay" : "mcq",
    answer: q?.answer ?? "",
    marks: Math.max(0, Number(q?.marks) || 1),
    required: Boolean(q?.required),
    section: typeof q?.section === "string" && q.section.trim() ? q.section.trim() : "",
  };
}

export function AssessmentManagerModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [passScore, setPassScore] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [negativeMarking, setNegativeMarking] = useState(0);
  const [windowMode, setWindowMode] = useState<WindowMode>("relief");
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [general, setGeneral] = useState<Question[]>([]);
  const [domains, setDomains] = useState<DomainSection[]>([]);
  const [step, setStep] = useState<"menu" | "manual" | "pdf-upload" | "pdf-review">("menu");
  const [pdfQuestions, setPdfQuestions] = useState<Question[]>([]);
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const [pdfError, setPdfError] = useState("");
  const [pdfTargets, setPdfTargets] = useState<Record<number, string>>({});
  const [pdfApplyAll, setPdfApplyAll] = useState("");
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
          setNegativeMarking(Math.max(0, Number(data.assessment.negativeMarking) || 0));
          setWindowMode(data.assessment.windowMode === "uniform" ? "uniform" : "relief");
          setTimeSlots(
            Array.isArray(data.assessment.timeSlots)
              ? data.assessment.timeSlots.map((s: any) => String(s?.start || "")).filter(Boolean)
              : []
          );
          setInstructions(String(data.assessment.instructions || ""));
          const pickedGeneral: Question[] = Array.isArray(data.assessment.questions)
            ? data.assessment.questions.map(normalizeQuestion)
            : [];
          setGeneral(pickedGeneral);
          const pickedDomains: DomainSection[] = Array.isArray(data.assessment.domains)
            ? data.assessment.domains.map((d: any) => ({
                id: newId(),
                name: d?.name ?? "",
                limit: Math.max(0, Number(d?.limit) || 0),
                questions: Array.isArray(d?.questions) ? d.questions.map(normalizeQuestion) : [],
              }))
            : [];
          setDomains(pickedDomains);
        }
        if (typeof data.job?.assessmentDurationMinutes === "number") {
          setDurationMinutes(data.job.assessmentDurationMinutes);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [jobId]);

  function addQuestion(list: Question[], setList: (v: Question[]) => void) {
    setList([...list, baseQuestion()]);
  }

  function removeQuestion(idx: number, list: Question[], setList: (v: Question[]) => void) {
    setList(list.filter((_, i) => i !== idx));
  }

  function updateQuestion(idx: number, patch: Partial<Question>, list: Question[], setList: (v: Question[]) => void) {
    const next = [...list];
    next[idx] = { ...next[idx], ...patch };
    setList(next);
  }

  function updateDomain(id: string, patch: Partial<DomainSection>) {
    setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function updateTimeSlot(idx: number, value: string) {
    setTimeSlots((prev) => prev.map((s, i) => (i === idx ? value : s)));
  }

  function removeTimeSlot(idx: number) {
    setTimeSlots((prev) => prev.filter((_, i) => i !== idx));
  }

  function addTimeSlot() {
    // Seed from the first gap so HR rarely has to type a whole list by hand.
    setTimeSlots((prev) => {
      const taken = new Set(prev.filter(Boolean));
      for (let h = 8; h <= 20; h++) {
        for (const m of ["00", "30"]) {
          const candidate = `${String(h).padStart(2, "0")}:${m}`;
          if (!taken.has(candidate)) return [...prev, candidate];
        }
      }
      return [...prev, "09:00"];
    });
  }

  function validate(): string {
    const hasAny =
      general.length > 0 || domains.some((d) => d.questions.length > 0);
    if (!hasAny) return "Add at least one question across the general section or the domain sections.";

    if (windowMode === "uniform" && timeSlots.length && timeSlots.some((s) => !TIME_RE.test(s))) {
      return "Every time slot needs a valid HH:MM start time.";
    }

    const sectionQ = (title: string, list: Question[]) => {
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        if (!q.text.trim()) return `${title} Question ${i + 1} needs text.`;
        if (q.type === "mcq") {
          const nonEmpty = q.options.map((o) => o.trim()).filter(Boolean);
          if (nonEmpty.length < 2) return `${title} Question ${i + 1} needs at least 2 options.`;
        }
      }
      return "";
    };

    let err = sectionQ("General", general);
    if (err) return err;
    for (const d of domains) {
      if (d.questions.length > 0 && !d.name.trim()) {
        return "Every domain with questions needs a name.";
      }
      if (d.questions.length > 0) {
        const label = d.name.trim();
        err = sectionQ(label, d.questions);
        if (err) return err;
      }
    }
    return "";
  }

  function buildPayload() {
    const buildQuestion = (q: Question) => {
      const type = q.type === "essay" ? "essay" : "mcq";
      if (type === "essay") {
        return { text: q.text, options: [], correctIndex: 0, type, answer: q.answer ?? "", marks: Math.max(0, q.marks || 1), required: q.required };
      }
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      const correctIndex = Math.max(0, Math.min(options.length - 1, q.correctIndex || 0));
      return { text: q.text, options, correctIndex, type, answer: "", marks: Math.max(0, q.marks || 1), required: q.required };
    };
    return {
      passScore,
      durationMinutes,
      negativeMarking: Math.max(0, Number(negativeMarking) || 0),
      windowMode,
      timeSlots: timeSlots.filter((s) => TIME_RE.test(s)).map((start) => ({ start })),
      instructions: instructions.trim(),
      questions: general.map(buildQuestion),
      domains: domains
        .filter((d) => d.name.trim() && d.questions.length > 0)
        .map((d) => ({
          name: d.name.trim(),
          limit: Math.max(0, d.limit || 0),
          questions: d.questions.map(buildQuestion),
        })),
    };
  }

  async function handleSave() {
    if (savingRef.current) return;
    const err = validate();
    if (err) { setError(err); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
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
      const parsed: Question[] = (data.questions || []).map((q: any) =>
        normalizeQuestion(q)
      );
      setPdfQuestions(parsed);
      setPdfWarnings(Array.isArray(data.warnings) ? data.warnings : []);

      const targets: Record<number, string> = {};
      if (parsed.length) {
        const nameToDomain = new Map<string, string>();
        for (const d of domains) {
          const key = d.name.trim().toLowerCase();
          if (key) nameToDomain.set(key, d.id);
        }
        const created: DomainSection[] = [];
        parsed.forEach((q, i) => {
          const sec = q.section?.trim() || "";
          if (!sec || /^(general|common)/i.test(sec)) {
            targets[i] = "general";
            return;
          }
          const key = sec.toLowerCase();
          let domainId = nameToDomain.get(key);
          if (!domainId) {
            const existingCreated = created.find((c) => c.name.toLowerCase() === key);
            if (existingCreated) {
              domainId = existingCreated.id;
            } else {
              domainId = newId();
              const nd = { id: domainId, name: sec, limit: 0, questions: [] };
              created.push(nd);
              nameToDomain.set(key, domainId);
            }
          }
          targets[i] = domainId;
        });
        if (created.length) setDomains((prev) => [...prev, ...created]);
        const routed = Object.values(targets).some((v) => v !== "general");
        setPdfWarnings((prev) => [
          ...(Array.isArray(prev) ? prev : []),
          routed
            ? `${created.length} section${created.length === 1 ? "" : "s"} detected and added as domain${created.length === 1 ? "" : "s"}. Adjust any question below if needed.`
            : "No section/domain headers detected. All questions default to General — use the per-question dropdown to route them.",
        ]);
      }
      setPdfTargets(targets);
      setStep("pdf-review");
    } catch (e: any) {
      setPdfError(e.message);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePdfConfirm() {
    const grouped = new Map<string, Question[]>();
    pdfQuestions.forEach((q, i) => {
      const target = pdfTargets[i] ?? "general";
      if (!grouped.has(target)) grouped.set(target, []);
      grouped.get(target)!.push(q);
    });

    const generalQs = grouped.get("general");
    if (generalQs && generalQs.length) setGeneral((prev) => [...prev, ...generalQs]);

    setDomains((prev) => {
      const next = prev.map((d) => {
        const extra = grouped.get(d.id);
        return extra && extra.length ? { ...d, questions: [...d.questions, ...extra] } : d;
      });
      grouped.forEach((qs, target) => {
        if (target !== "general" && !next.some((d) => d.id === target)) {
          next.push({ id: target, name: "", limit: 0, questions: qs });
        }
      });
      return next;
    });

    setStep("manual");
    await handleSave();
  }

  const totalCount = general.length + domains.reduce((s, d) => s + d.questions.length, 0);

  function partsSummary(): string {
    const parts: string[] = [];
    if (general.length) parts.push(`general: ${general.length}`);
    for (const d of domains) {
      if (d.questions.length) parts.push(`${d.name.trim() || "domain"}: ${d.questions.length}`);
    }
    if (!parts.length) return "";
    return ` (${parts.join(", ")})`;
  }

  const renderQuestionCard = (q: Question, idx: number, editable: boolean, list: Question[], setList: (v: Question[]) => void) => (
    <div key={idx} className={`rounded-lg border p-4 dark:border-zinc-800 ${q.type === "essay" ? "border-violet-200 bg-violet-50/40 dark:border-violet-900/40" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Question {idx + 1}</span>
          <textarea
            value={q.text}
            onChange={(e) => updateQuestion(idx, { text: e.target.value }, list, setList)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
            placeholder="Enter question text..."
          />
        </label>
        {editable && (
          <button onClick={() => removeQuestion(idx, list, setList)} className="mt-4 shrink-0 rounded p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => updateQuestion(idx, { type: "mcq", options: q.options.length >= 2 ? q.options : ["", "", "", ""], correctIndex: q.correctIndex }, list, setList)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${q.type === "mcq" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
        >
          Multiple choice
        </button>
        <button
          type="button"
          onClick={() => updateQuestion(idx, { type: "essay", options: [], correctIndex: 0 }, list, setList)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${q.type === "essay" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
        >
          Essay
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {editable && (
            <>
              <span className="text-xs text-slate-400">Marks</span>
              {[1, 2, 3].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateQuestion(idx, { marks: m }, list, setList)}
                  className={`rounded-md px-2 py-1 text-xs font-bold ${q.marks === m ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"}`}
                >
                  +{m}
                </button>
              ))}
              <input
                type="number"
                min="0"
                max="100"
                value={q.marks}
                onChange={(e) => updateQuestion(idx, { marks: Number(e.target.value) }, list, setList)}
                className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
                title="Marks for correct answer"
              />
            </>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => updateQuestion(idx, { required: !q.required }, list, setList)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${q.required ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
              title={q.required ? "Mandatory — candidate must answer this" : "Optional — candidate may skip this"}
            >
              {q.required ? "Required" : "Optional"}
            </button>
          )}
          {!editable && <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">+{q.marks || 1} marks{!q.required ? " · optional" : ""}</span>}
        </div>
      </div>

      {q.type === "mcq" ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {q.options.map((opt, oi) => (
              <label key={oi} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-zinc-800">
                <input type="radio" name={`correct-${idx}`} checked={q.correctIndex === oi} onChange={(e) => { if (e.target.checked) updateQuestion(idx, { correctIndex: oi }, list, setList); }} className="h-3 w-3" title="Mark as correct answer" />
                <span className="w-4 shrink-0 text-xs font-semibold text-slate-400">{String.fromCharCode(65 + oi)}</span>
                <input
                  value={opt}
                  onChange={(e) => {
                    const opts = [...list[idx].options];
                    opts[oi] = e.target.value;
                    updateQuestion(idx, { options: opts }, list, setList);
                  }}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                />
                {q.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const opts = list[idx].options.filter((_, i) => i !== oi);
                      const q2 = { ...list[idx], options: opts };
                      if (q2.correctIndex > opts.length - 1) q2.correctIndex = Math.max(0, opts.length - 1);
                      updateQuestion(idx, { options: opts, correctIndex: q2.correctIndex }, list, setList);
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
          <button type="button" onClick={() => updateQuestion(idx, { options: [...list[idx].options, ""] }, list, setList)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400">
            <Plus size={12} /> Add option
          </button>
        </>
      ) : (
        <div className="mt-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Expected answer / message</span>
            <textarea
              value={q.answer ?? ""}
              onChange={(e) => updateQuestion(idx, { answer: e.target.value }, list, setList)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
              placeholder="Candidates will type a free-form essay. Save the expected answer or grading hints here for manual review."
            />
          </label>
        </div>
      )}
    </div>
  );

  const renderScheduling = () => (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Timing mode</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              {
                value: "relief" as WindowMode,
                label: "Flexible duration",
                hint: "The candidate can start any time once the assessment date arrives, and the full duration runs from their own start.",
              },
              {
                value: "uniform" as WindowMode,
                label: "Fixed slots",
                hint: "The candidate picks a start time and is held to that slot's fixed end. Offer several times so they can choose.",
              },
            ]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWindowMode(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${windowMode === opt.value ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {windowMode === "relief"
            ? "The waiting room opens ten minutes before the assessment date on the job. Starting stays open until the end of that day."
            : "The waiting room opens ten minutes before the earliest slot. Each candidate stops at their chosen slot's start plus the duration above."}
        </p>
      </div>

      {windowMode === "uniform" && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">
            Start times <span className="text-xs font-normal text-slate-400">on the assessment date</span>
          </span>
          {timeSlots.length === 0 && (
            <p className="mb-2 text-xs text-slate-400">
              No extra times set — the assessment date and time on the job is used as the single slot.
            </p>
          )}
          <div className="space-y-2">
            {timeSlots.map((slot, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  value={slot}
                  onChange={(e) => updateTimeSlot(i, e.target.value)}
                  className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
                />
                <span className="text-xs text-slate-400">
                  stops at{" "}
                  {formatSlotEnd(slot, durationMinutes)}
                </span>
                <button
                  type="button"
                  onClick={() => removeTimeSlot(i)}
                  className="ml-auto rounded p-1.5 text-rose-500 hover:bg-rose-50"
                  title="Remove time slot"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addTimeSlot}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400"
          >
            <Plus size={14} /> Add time
          </button>
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">
          Instructions for candidates <span className="text-xs font-normal text-slate-400">(optional)</span>
        </span>
        <textarea
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Shown in the waiting room before the assessment opens, e.g. rules on switching tabs, permitted materials, who to contact."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
        />
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Passing Score (%)</span>
        <input type="number" min="0" max="100" value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Duration (minutes)</span>
        <input type="number" min="1" max="600" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" placeholder="e.g. 60" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">
          Negative marking <span className="text-xs font-normal text-slate-400">(0 = off)</span>
        </span>
        <input type="number" min="0" step="0.01" value={negativeMarking} onChange={(e) => setNegativeMarking(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800" placeholder="e.g. 0.25" />
      </label>
      </div>
      {renderScheduling()}
    </div>
  );

  const renderSection = (title: string, subtitle: string | undefined, list: Question[], setList: (v: Question[]) => void, onRemove?: () => void, nameField?: React.ReactNode) => (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {onRemove && (
          <button onClick={onRemove} className="rounded p-1.5 text-rose-500 hover:bg-rose-50" title="Remove domain">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {nameField}
      <div className="mt-3 space-y-4">
        {list.map((q, qi) => renderQuestionCard(q, qi, true, list, setList))}
      </div>
      <button onClick={() => addQuestion(list, setList)} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400">
        <Plus size={14} /> Add Question
      </button>
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
              {renderSettings()}

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
                    Add questions section by section. Set marks, required/optional and per-domain question limits.
                  </p>
                </button>
              </div>

              {totalCount > 0 && (
                <p className="text-xs text-slate-400">
                  {totalCount} question{totalCount === 1 ? " is" : "s are"} currently saved
                  {partsSummary()}.
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
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Set all parsed questions to section</span>
                <select
                  value={pdfApplyAll}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    setPdfTargets((prev) => {
                      const next: Record<number, string> = {};
                      for (const k of Object.keys(prev)) next[Number(k)] = v;
                      return next;
                    });
                    setPdfApplyAll("");
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <option value="">Select a section to apply to all questions</option>
                  <option value="general">General / Common questions</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name.trim() || "Untitled domain"}</option>
                  ))}
                </select>
              </label>
              {domains.length === 0 && (
                <p className="text-xs text-slate-400">Tip: questions are added to the General section by default. Create domains first (Manual questions flow) or add section headers in your PDF (e.g. &quot;Section: JavaScript&quot;) to route them automatically.</p>
              )}
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Each question below has its own section selector — set one to General or any domain, then confirm. Existing questions in each target section are kept.
              </p>
              <div className="space-y-4">
                {pdfQuestions.map((q, qi) => (
                  <div key={qi}>
                    <div className="mb-1 flex items-center justify-end gap-2">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400">
                        <span>Section</span>
                        <select
                          value={pdfTargets[qi] ?? "general"}
                          onChange={(e) => setPdfTargets((prev) => ({ ...prev, [qi]: e.target.value }))}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <option value="general">General / Common questions</option>
                          {domains.map((d) => (
                            <option key={d.id} value={d.id}>{d.name.trim() || "Untitled domain"}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {renderQuestionCard(q, qi, true, pdfQuestions, setPdfQuestions)}
                  </div>
                ))}
              </div>
            </>
          )}

          {step === "manual" && (
            <>
              {renderSettings()}

              {renderSection(
                "General / Common questions",
                "Every candidate answers these, regardless of domain.",
                general,
                setGeneral
              )}

              {domains.map((d) =>
                renderSection(
                  d.name.trim() || "Untitled domain",
                  undefined,
                  d.questions,
                  (list) => updateDomain(d.id, { questions: list }),
                  () => setDomains((prev) => prev.filter((x) => x.id !== d.id)),
                  (
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-500">Domain / category name</span>
                        <input
                          value={d.name}
                          onChange={(e) => updateDomain(d.id, { name: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
                          placeholder="e.g. Mechanical, Electrical, Computer Science"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-500">Question limit <span className="text-[10px] font-normal text-slate-400">(0 = unlimited)</span></span>
                        <input
                          type="number"
                          min="0"
                          value={d.limit}
                          onChange={(e) => updateDomain(d.id, { limit: Math.max(0, Number(e.target.value)) })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
                          placeholder="e.g. 10, 20, 30"
                        />
                      </label>
                    </div>
                  )
                )
              )}

              <button
                onClick={() => setDomains((prev) => [...prev, baseDomain(newId())])}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-indigo-300 px-3 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
              >
                <Plus size={14} /> Add Domain / Category
              </button>
            </>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-2 dark:border-zinc-800">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">Cancel</button>
            {(step === "manual" || step === "menu") && (
              <button onClick={() => void handleSave()} disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200">
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