"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, FileText, PenLine, ArrowLeft, Loader2, Upload, CircleCheck } from "lucide-react";
import { formatNegativeMarking, parseNegativeMarking } from "@/lib/assessment-negative-marking";
import {
  MAX_NOISE_THRESHOLD_DB,
  MIN_NOISE_THRESHOLD_DB,
  type ProctoringConfig,
} from "@/lib/assessment-proctoring";

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

const DEFAULT_PROCTORING_UI: ProctoringConfig = {
  enabled: false,
  requireCamera: true,
  requireMic: true,
  requireFullscreen: true,
  blockOnFocusLoss: true,
  noiseThresholdDb: -35,
  noiseWarningLimit: 3,
  requireSingleFace: false,
  blockScreenShare: true,
};

/** What a PDF should be filed under: the shared general section, or a domain. */
type PdfDraft = {
  kind: "general" | "domain";
  domainName: string;
  domainLimit: number;
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Sentinel for the "+ New domain..." option in the PDF review selectors. */
const NEW_DOMAIN_VALUE = "__new__";


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
  // Kept as text so HR can type "1/4" as well as "0.25"; the number and the
  // fraction label are both derived from it.
  const [negativeMarkingText, setNegativeMarkingText] = useState("0");
  const [windowMode, setWindowMode] = useState<WindowMode>("relief");
  const [proctoring, setProctoring] = useState<ProctoringConfig>(DEFAULT_PROCTORING_UI);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [general, setGeneral] = useState<Question[]>([]);
  const [domains, setDomains] = useState<DomainSection[]>([]);
  const [step, setStep] = useState<"menu" | "manual" | "pdf-upload" | "pdf-review" | "final-check">("menu");
  const [pdfQuestions, setPdfQuestions] = useState<Question[]>([]);
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const [pdfError, setPdfError] = useState("");
  const [pdfTargets, setPdfTargets] = useState<Record<number, string>>({});
  const [pdfApplyAll, setPdfApplyAll] = useState("");
  /** Which selector asked for a brand new domain: "all" or a question index. */
  const [pdfNewDomainFor, setPdfNewDomainFor] = useState<"all" | number | null>(null);
  const [pdfNewDomainName, setPdfNewDomainName] = useState("");
  /** Where the next PDF gets filed, chosen before the file is picked. */
  const [pdfDraft, setPdfDraft] = useState<PdfDraft>({ kind: "general", domainName: "", domainLimit: 0 });
  /** True while one review batch is on screen, so a second PDF appends to it. */
  const [pdfBatchActive, setPdfBatchActive] = useState(false);
  const [addingAnother, setAddingAnother] = useState(false);
  /**
   * Questions staged by "Confirm & Save" and waiting on the final-check step.
   * Kept out of `general`/`domains` on purpose: re-running the merge after going
   * back to the review step must not append the same PDF twice, and nothing
   * reaches the database until the candidate-facing settings are confirmed.
   */
  const [pdfPending, setPdfPending] = useState<{ general: Question[]; domains: DomainSection[] } | null>(null);
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
          setNegativeMarkingText(
            String(data.assessment.negativeMarkingLabel || "") || String(data.assessment.negativeMarking ?? 0)
          );
          setWindowMode(data.assessment.windowMode === "uniform" ? "uniform" : "relief");
          setProctoring({
            ...DEFAULT_PROCTORING_UI,
            ...(typeof data.assessment.proctoring === "object" && data.assessment.proctoring
              ? data.assessment.proctoring
              : {}),
          } as ProctoringConfig);
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

  /** Creates a domain and returns its id. */
  function createPdfDomain(rawName: string): string {
    const name = rawName.trim();
    if (!name) return "";
    const id = newId();
    setDomains((prev) => [...prev, { ...baseDomain(id), name }]);
    return id;
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

  function validate(generalList: Question[], domainList: DomainSection[]): string {
    const marking = parseNegativeMarking(negativeMarkingText);
    if (!marking.ok) return marking.error;

    const hasAny =
      generalList.length > 0 || domainList.some((d) => d.questions.length > 0);
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

    let err = sectionQ("General", generalList);
    if (err) return err;
    for (const d of domainList) {
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

  /** The parsed negative-marking text, or the message to show under the field. */
  const negativeMarking = useMemo(() => parseNegativeMarking(negativeMarkingText), [negativeMarkingText]);

  function buildPayload(generalList: Question[], domainList: DomainSection[]) {
    const buildQuestion = (q: Question) => {
      const type = q.type === "essay" ? "essay" : "mcq";
      if (type === "essay") {
        return { text: q.text, options: [], correctIndex: 0, type, answer: q.answer ?? "", marks: Math.max(0, q.marks || 1), required: q.required };
      }
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      const correctIndex = Math.max(0, Math.min(options.length - 1, q.correctIndex || 0));
      return { text: q.text, options, correctIndex, type, answer: "", marks: Math.max(0, q.marks || 1), required: q.required };
    };
    const marking = parseNegativeMarking(negativeMarkingText);
    return {
      passScore,
      durationMinutes,
      negativeMarking: marking.ok ? marking.value : 0,
      negativeMarkingLabel: marking.ok ? marking.label : "",
      windowMode,
      timeSlots: timeSlots.filter((s) => TIME_RE.test(s)).map((start) => ({ start })),
      proctoring,
      instructions: instructions.trim(),
      questions: generalList.map(buildQuestion),
      domains: domainList
        .filter((d) => d.name.trim() && d.questions.length > 0)
        .map((d) => ({
          name: d.name.trim(),
          limit: Math.max(0, d.limit || 0),
          questions: d.questions.map(buildQuestion),
        })),
    };
  }

  /** Resolves to true once the assessment has actually been written. */
  async function handleSave(generalList?: Question[], domainList?: DomainSection[]): Promise<boolean> {
    if (savingRef.current) return false;
    const nextGeneral = generalList ?? general;
    const nextDomains = domainList ?? domains;
    const err = validate(nextGeneral, nextDomains);
    if (err) { setError(err); return false; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(nextGeneral, nextDomains)),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string })?.error || `Server error (${res.status}).`);
      setSuccess("Assessment saved successfully.");
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleUploadPdf(file: File) {
    setPdfError("");
    const draft = pdfDraft;
    if (draft.kind === "domain" && !draft.domainName.trim()) {
      setPdfError("Enter a domain / category name, or pick General / Common questions.");
      return;
    }
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

      // A batch already on screen means "add another PDF": keep it and append,
      // so nothing parsed so far is thrown away.
      const append = pdfBatchActive;
      const offset = append ? pdfQuestions.length : 0;
      setPdfQuestions((prev) => (append ? [...prev, ...parsed] : parsed));
      setPdfWarnings((prev) => {
        const incoming = Array.isArray(data.warnings) ? data.warnings : [];
        return append && prev.length ? [...prev, ...incoming] : incoming;
      });

      // Names already in play, so a PDF header matching an existing domain reuses it.
      const nameToDomain = new Map<string, string>();
      for (const d of domains) {
        const key = d.name.trim().toLowerCase();
        if (key) nameToDomain.set(key, d.id);
      }
      const newDomains: DomainSection[] = [];

      // An explicitly named domain wins for every question in this PDF, so the
      // header detection below is only consulted for general PDFs.
      let explicitDomainId = "";
      if (draft.kind === "domain") {
        const wanted = draft.domainName.trim();
        const key = wanted.toLowerCase();
        const existing = domains.find((d) => d.name.trim().toLowerCase() === key);
        if (existing) {
          explicitDomainId = existing.id;
        } else {
          explicitDomainId = newId();
          newDomains.push({ id: explicitDomainId, name: wanted, limit: Math.max(0, draft.domainLimit || 0), questions: [] });
          nameToDomain.set(key, explicitDomainId);
        }
      }

      const targets: Record<number, string> = {};
      const detected: string[] = [];
      if (parsed.length) {
        parsed.forEach((q, i) => {
          const idx = offset + i;
          if (explicitDomainId) {
            targets[idx] = explicitDomainId;
            return;
          }
          const sec = q.section?.trim() || "";
          if (!sec || /^(general|common)/i.test(sec)) {
            targets[idx] = "general";
            return;
          }
          detected.push(sec);
          const key = sec.toLowerCase();
          let domainId = nameToDomain.get(key);
          if (!domainId) {
            const alreadyCreated = newDomains.find((c) => c.name.toLowerCase() === key);
            if (alreadyCreated) {
              domainId = alreadyCreated.id;
            } else {
              domainId = newId();
              newDomains.push({ id: domainId, name: sec, limit: 0, questions: [] });
              nameToDomain.set(key, domainId);
            }
          }
          targets[idx] = domainId;
        });
        if (newDomains.length) setDomains((prev) => [...prev, ...newDomains]);
        const routed = Object.values(targets).some((v) => v !== "general");
        setPdfWarnings((prev) => [
          ...(Array.isArray(prev) ? prev : []),
          explicitDomainId
            ? `${parsed.length} question${parsed.length === 1 ? "" : "s"} will be added to "${draft.domainName.trim()}".${detected.length ? ` Section headers in the PDF (${Array.from(new Set(detected)).join(", ")}) were ignored.` : ""} Reassign any question below if needed.`
            : routed
              ? `${newDomains.length} section${newDomains.length === 1 ? "" : "s"} detected and added as domain${newDomains.length === 1 ? "" : "s"}. Rename them below or reassign any question.`
              : "No section/domain headers detected. All questions default to General — create a domain below or use the per-question dropdown to route them.",
        ]);
      }
      setPdfTargets((prev) => (append ? { ...prev, ...targets } : targets));
      setPdfBatchActive(true);
      setAddingAnother(false);
      setPdfNewDomainFor(null);
      setPdfNewDomainName("");
      setStep("pdf-review");
    } catch (e: any) {
      setPdfError(e.message);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function commitNewPdfDomain() {
    const name = pdfNewDomainName.trim();
    if (!name || pdfNewDomainFor == null) return;
    const wanted = name.toLowerCase();
    const existing = domains.find((d) => d.name.trim().toLowerCase() === wanted);
    const id = existing ? existing.id : createPdfDomain(name);
    if (pdfNewDomainFor === "all") {
      setPdfTargets((prev) => {
        const next: Record<number, string> = {};
        for (const k of Object.keys(prev)) next[Number(k)] = id;
        return next;
      });
    } else {
      setPdfTargets((prev) => ({ ...prev, [pdfNewDomainFor]: id }));
    }
    setPdfNewDomainFor(null);
    setPdfNewDomainName("");
  }

  /**
   * Fold the reviewed PDF batch into the saved question set. Pure: it always
   * builds from the current `general`/`domains`, never from a previous result,
   * so confirming twice cannot append the same questions twice.
   */
  function mergePdfIntoSaved() {
    const grouped = new Map<string, Question[]>();
    pdfQuestions.forEach((q, i) => {
      const target = pdfTargets[i] ?? "general";
      if (!grouped.has(target)) grouped.set(target, []);
      grouped.get(target)!.push(q);
    });

    const nextGeneral = [...general];
    const generalQs = grouped.get("general");
    if (generalQs && generalQs.length) nextGeneral.push(...generalQs);

    const nextDomains = domains.map((d) => {
      const extra = grouped.get(d.id);
      return extra && extra.length ? { ...d, questions: [...d.questions, ...extra] } : d;
    });
    grouped.forEach((qs, target) => {
      if (target !== "general" && !nextDomains.some((d) => d.id === target)) {
        nextDomains.push({ id: target, name: "", limit: 0, questions: qs });
      }
    });

    return { general: nextGeneral, domains: nextDomains };
  }

  /** Stage the merge and move to the settings check. Nothing is saved yet. */
  function handlePdfConfirm() {
    setPdfPending(mergePdfIntoSaved());
    setError("");
    setSuccess("");
    setStep("final-check");
  }

  /** Commit the staged merge for real. This is the only thing that writes. */
  async function handleSubmitPending() {
    if (!pdfPending) return;
    const ok = await handleSave(pdfPending.general, pdfPending.domains);
    if (!ok) return;
    setGeneral(pdfPending.general);
    setDomains(pdfPending.domains);
    setPdfPending(null);
    // End the batch so a later PDF starts a fresh review list instead of
    // re-adding these same questions.
    setPdfBatchActive(false);
    setAddingAnother(false);
    setStep("manual");
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

  /**
   * What the staged assessment will look like for a candidate: every candidate
   * answers the general questions, then the questions of the one domain they
   * pick, capped by that domain's limit (0 = the whole domain).
   */
  const renderPendingSummary = () => {
    const pending = pdfPending;
    if (!pending) return null;
    const live = pending.domains.filter((d) => d.questions.length > 0);
    const generalCount = pending.general.length;
    const total = generalCount + live.reduce((s, d) => s + d.questions.length, 0);

    return (
      <div className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Questions to be saved</h3>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            {total} question{total === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-slate-600 dark:text-zinc-300">
              General / Common
              <span className="ml-1 text-xs text-slate-400">every candidate answers these</span>
            </span>
            <span className="shrink-0 font-medium text-slate-900 dark:text-zinc-100">{generalCount}</span>
          </div>

          {live.length === 0 ? (
            <p className="text-xs text-slate-400">
              No domain questions. Every candidate gets the same paper.
            </p>
          ) : (
            live.map((d) => {
              const limit = Math.max(0, d.limit || 0);
              const served = limit > 0 ? Math.min(limit, d.questions.length) : d.questions.length;
              const capped = limit > 0 && limit < d.questions.length;
              return (
                <div key={d.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-slate-600 dark:text-zinc-300">
                    {d.name.trim() || "Untitled domain"}
                    <span className="ml-1 text-xs text-slate-400">
                      candidate sees {generalCount} + {served} = {generalCount + served}
                      {capped ? ` (limit ${limit})` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-slate-900 dark:text-zinc-100">{d.questions.length}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

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
          Negative marking <span className="text-xs font-normal text-slate-400">(0 = off, fraction or decimal)</span>
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={negativeMarkingText}
          onChange={(e) => setNegativeMarkingText(e.target.value)}
          aria-invalid={!negativeMarking.ok}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 dark:border-zinc-800 ${
            negativeMarking.ok
              ? "border-slate-200 focus:ring-emerald-500"
              : "border-rose-300 focus:ring-rose-500"
          }`}
          placeholder="e.g. 1/4 or 0.25"
        />
        {negativeMarking.ok ? (
          <span className="mt-1 block text-[11px] text-slate-400">
            {negativeMarking.value > 0
              ? `Deducts ${formatNegativeMarking(negativeMarking.value, negativeMarking.label)} marks for every wrong answer.`
              : "Negative marking is off."}
          </span>
        ) : (
          <span className="mt-1 block text-[11px] text-rose-600">{negativeMarking.error}</span>
        )}
      </label>
      </div>
      {renderScheduling()}
      {renderProctoring()}
    </div>
  );

  /**
   * Proctoring settings.
   *
   * The wording is deliberately explicit that these are checks and warnings, not
   * locks. HR is the one who has to explain to a rejected candidate why the
   * system let them cheat, so promising a guarantee the browser cannot keep
   * would be worse than being straight about it here.
   */
  const renderProctoring = () => (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={proctoring.enabled}
          onChange={(e) => setProctoring((prev) => ({ ...prev, enabled: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Proctor this assessment
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
            Open the paper fullscreen, keep the camera and microphone on, and record warnings when the
            candidate leaves the tab or the room is noisy.
          </span>
        </span>
      </label>

      {!proctoring.enabled ? (
        <p className="mt-3 text-xs text-slate-400">
          Off. Candidates can switch tabs, minimise, and use other applications without it being recorded.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            No browser can block tab switching or minimising. What this does is open the paper
            fullscreen, detect leaving it, cover the questions with a blocking notice until they
            come back, and hand the lost time back on the server — so it deters and evidences
            rather than prevents. The camera preview is local only: nothing is recorded, uploaded
            or streamed anywhere.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { key: "requireCamera" as const, label: "Camera required", hint: "Candidate cannot enter without a working camera." },
              { key: "requireMic" as const, label: "Microphone required", hint: "Needed for the background noise check." },
              { key: "requireFullscreen" as const, label: "Fullscreen enforced", hint: "Auto-disabled on devices with no Fullscreen API, such as iPhone Safari, rather than deadlocking them." },
              { key: "blockOnFocusLoss" as const, label: "Block on focus loss", hint: "Cover the questions until the candidate returns." },
              { key: "blockScreenShare" as const, label: "Detect screen sharing", hint: "Best-effort: flags casting started from this page." },
              { key: "requireSingleFace" as const, label: "Warn on multiple faces", hint: "Uses the browser's face detector when present, otherwise a motion heuristic. Warns only." },
            ].map((opt) => (
              <label
                key={opt.key}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  proctoring[opt.key]
                    ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-500/10"
                    : "border-slate-200 dark:border-zinc-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={proctoring[opt.key]}
                  onChange={(e) => setProctoring((prev) => ({ ...prev, [opt.key]: e.target.checked }))}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900 dark:text-zinc-100">{opt.label}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">
                Warn above this noise level
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={MIN_NOISE_THRESHOLD_DB}
                  max={MAX_NOISE_THRESHOLD_DB}
                  step="1"
                  value={proctoring.noiseThresholdDb}
                  onChange={(e) =>
                    setProctoring((prev) => ({
                      ...prev,
                      noiseThresholdDb: Number(e.target.value),
                    }))
                  }
                  className="flex-1 accent-emerald-600"
                />
                <span className="w-20 shrink-0 text-right font-mono text-sm text-slate-700 dark:text-zinc-300">
                  {proctoring.noiseThresholdDb} dB
                </span>
              </div>
              <span className="mt-1 block text-[11px] text-slate-400">
                0 dB is a clipped microphone. Around -35 dB is a normal speaking voice, -55 dB is
                close to silence.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">
                Noise warnings before it stops nagging
              </span>
              <input
                type="number"
                min="0"
                max="20"
                value={proctoring.noiseWarningLimit}
                onChange={(e) =>
                  setProctoring((prev) => ({
                    ...prev,
                    noiseWarningLimit: Math.min(20, Math.max(0, Math.round(Number(e.target.value) || 0))),
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                Warnings are spaced at least 20 seconds apart, so {proctoring.noiseWarningLimit} takes
                real time rather than three seconds.
              </span>
            </label>
          </div>
        </div>
      )}
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

  /**
   * Shared by the first upload and by "Add another PDF" inside the review step,
   * so both entry points ask for the target section the same way.
   */
  const renderPdfDraftForm = (opts: { collapsible?: boolean } = {}) => (
    <div className={`rounded-xl border p-4 ${opts.collapsible ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-zinc-800"}`}>
      {opts.collapsible && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
            These {pdfQuestions.length} parsed question{pdfQuestions.length === 1 ? "" : "s"} stay. The new PDF is added on top.
          </p>
          <button
            type="button"
            onClick={() => { setAddingAnother(false); setPdfError(""); }}
            className="rounded p-1.5 text-slate-500 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Cancel"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">Add these questions to</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              pdfDraft.kind === "general"
                ? "border-emerald-400 bg-emerald-50/60 dark:border-emerald-600/60 dark:bg-emerald-500/10"
                : "border-slate-200 dark:border-zinc-800"
            }`}
          >
            <input
              type="radio"
              name="pdf-target"
              className="mt-0.5"
              checked={pdfDraft.kind === "general"}
              onChange={() => setPdfDraft((prev) => ({ ...prev, kind: "general" }))}
            />
            <span className="min-w-0">
              <span className="block font-medium text-slate-900 dark:text-zinc-100">General / Common questions</span>
              <span className="block text-xs text-slate-500 dark:text-zinc-400">Every candidate answers these, regardless of domain.</span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              pdfDraft.kind === "domain"
                ? "border-indigo-400 bg-indigo-50/60 dark:border-indigo-600/60 dark:bg-indigo-500/10"
                : "border-slate-200 dark:border-zinc-800"
            }`}
          >
            <input
              type="radio"
              name="pdf-target"
              className="mt-0.5"
              checked={pdfDraft.kind === "domain"}
              onChange={() => setPdfDraft((prev) => ({ ...prev, kind: "domain" }))}
            />
            <span className="min-w-0">
              <span className="block font-medium text-slate-900 dark:text-zinc-100">Domain / Category</span>
              <span className="block text-xs text-slate-500 dark:text-zinc-400">Candidates pick this domain, plus the general questions.</span>
            </span>
          </label>
        </div>
      </fieldset>

      {pdfDraft.kind === "domain" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Domain / category name</span>
            <input
              value={pdfDraft.domainName}
              onChange={(e) => setPdfDraft((prev) => ({ ...prev, domainName: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="e.g. Mechanical, Electrical, Computer Science"
            />
            {domains.some((d) => d.name.trim().toLowerCase() === pdfDraft.domainName.trim().toLowerCase() && pdfDraft.domainName.trim()) && (
              <span className="mt-1 block text-[11px] text-amber-600 dark:text-amber-400">
                A domain with this name already exists — these questions will be added to it.
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Question limit <span className="text-[10px] font-normal text-slate-400">(0 = unlimited)</span></span>
            <input
              type="number"
              min="0"
              value={pdfDraft.domainLimit}
              onChange={(e) => setPdfDraft((prev) => ({ ...prev, domainLimit: Math.max(0, Number(e.target.value) || 0) }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="e.g. 10, 20, 30"
            />
          </label>
        </div>
      )}

      <div className="mt-3">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">PDF file</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={parsing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUploadPdf(file);
          }}
          className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:border-zinc-800 dark:file:mr-3 dark:file:rounded dark:file:border-0 dark:file:bg-slate-100 dark:file:px-3 dark:file:py-1.5 dark:file:text-xs dark:file:font-medium dark:file:text-slate-700"
        />
      </div>
      {parsing && (
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Parsing questions...
        </p>
      )}
      {pdfError && <p className="mt-2 text-sm text-rose-600">{pdfError}</p>}
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
            <button
              onClick={() => {
                // From the settings check, Back returns to the review list so
                // routing can be fixed; the staged merge is recomputed from
                // there, so it is safe to leave it in place.
                if (step === "final-check") { setStep("pdf-review"); return; }
                setPdfBatchActive(false);
                setAddingAnother(false);
                setPdfError("");
                setPdfPending(null);
                setPdfDraft({ kind: "general", domainName: "", domainLimit: 0 });
                setStep("menu");
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              <ArrowLeft size={16} /> {step === "final-check" ? "Back to questions" : "Back"}
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
              {renderSettings()}

              <p className="text-sm text-slate-600 dark:text-zinc-300">
                Upload a PDF containing questions with options and their answers. Choose where it goes, then pick the file.
              </p>
              {renderPdfDraftForm()}
            </>
          )}

          {step === "final-check" && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Check the settings before saving</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  These are the values candidates will see. Nothing is saved until you press Submit assessment.
                </p>
              </div>

              {renderPendingSummary()}

              {renderSettings()}

              {pdfWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <p className="font-semibold">Worth a second look from the PDF import:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {pdfWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}

          {step === "pdf-review" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Review parsed questions</h3>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {pdfQuestions.length} detected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setAddingAnother((v) => !v); setPdfError(""); }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    addingAnother
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Upload size={13} /> {addingAnother ? "Cancel" : "Add another PDF"}
                </button>
              </div>
              {addingAnother && (
                <>
                  {renderPdfDraftForm({ collapsible: true })}
                  <hr className="border-slate-200 dark:border-zinc-800" />
                </>
              )}
              {pdfWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <p className="font-semibold">Review these before saving:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {pdfWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Domains / Subjects</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Name the domains your PDF is split into. Candidates pick one and only see the general questions plus their own domain.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPdfNewDomainFor("all"); setPdfNewDomainName(""); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                  >
                    <Plus size={13} /> Add Domain
                  </button>
                </div>

                {pdfNewDomainFor === "all" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      autoFocus
                      value={pdfNewDomainName}
                      onChange={(e) => setPdfNewDomainName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNewPdfDomain(); } }}
                      placeholder="e.g. Mechanical, Electrical, Civil, Computer Science"
                      className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={commitNewPdfDomain}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPdfNewDomainFor(null); setPdfNewDomainName(""); }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {domains.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {domains.map((d) => {
                      const routed = Object.values(pdfTargets).filter((v) => v === d.id).length;
                      return (
                        <div key={d.id} className="grid gap-2 sm:grid-cols-[1fr_9rem_auto] sm:items-center">
                          <input
                            value={d.name}
                            onChange={(e) => updateDomain(d.id, { name: e.target.value })}
                            placeholder="Domain name"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                          />
                          <input
                            type="number"
                            min="0"
                            value={d.limit}
                            onChange={(e) => updateDomain(d.id, { limit: Math.max(0, Number(e.target.value) || 0) })}
                            placeholder="Limit"
                            title="How many of this domain's questions a candidate gets (0 = all)"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                          />
                          <div className="flex items-center gap-2">
                            <span className="whitespace-nowrap text-xs text-slate-500 dark:text-zinc-400">
                              {routed} parsed{d.questions.length > 0 ? ` · ${d.questions.length} saved` : ""}
                            </span>
                            {d.questions.length === 0 ? (
                              <button
                                type="button"
                                title="Remove domain"
                                onClick={() => {
                                  setDomains((prev) => prev.filter((x) => x.id !== d.id));
                                  setPdfTargets((prev) => {
                                    const next: Record<number, string> = {};
                                    for (const [k, v] of Object.entries(prev)) next[Number(k)] = v === d.id ? "general" : v;
                                    return next;
                                  });
                                }}
                                className="rounded p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <span className="p-1.5" title="This domain already has saved questions. Remove it from the Manual questions view to delete it." />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-slate-400">
                      Right column is the number of parsed questions routed here. Leave the limit at 0 to serve the whole domain.
                    </p>                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Set all parsed questions to section</span>
                <select
                  value={pdfApplyAll}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    if (v === NEW_DOMAIN_VALUE) { setPdfNewDomainFor("all"); setPdfNewDomainName(""); setPdfApplyAll(""); return; }
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
                  <option value={NEW_DOMAIN_VALUE}>+ New domain...</option>
                </select>
              </label>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Each question below has its own section selector — set one to General or any domain, then confirm. Existing questions in each target section are kept.
              </p>
              <div className="space-y-4">
                {pdfQuestions.map((q, qi) => {
                  const target = pdfTargets[qi] ?? "general";
                  const isNew = pdfNewDomainFor === qi;
                  return (
                    <div key={qi}>
                      <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400">
                          <span>Section</span>
                          <select
                            value={isNew ? NEW_DOMAIN_VALUE : target}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === NEW_DOMAIN_VALUE) { setPdfNewDomainFor(qi); setPdfNewDomainName(""); return; }
                              setPdfTargets((prev) => ({ ...prev, [qi]: v }));
                            }}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <option value="general">General / Common questions</option>
                            {domains.map((d) => (
                              <option key={d.id} value={d.id}>{d.name.trim() || "Untitled domain"}</option>
                            ))}
                            <option value={NEW_DOMAIN_VALUE}>+ New domain...</option>
                          </select>
                        </label>
                        {isNew && (
                          <input
                            autoFocus
                            value={pdfNewDomainName}
                            onChange={(e) => setPdfNewDomainName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNewPdfDomain(); } }}
                            placeholder="Domain name"
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
                          />
                        )}
                      </div>
                      {renderQuestionCard(q, qi, true, pdfQuestions, setPdfQuestions)}
                    </div>
                  );
                })}
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
              <button onClick={handlePdfConfirm} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            )}
            {step === "final-check" && (
              <>
                <button onClick={() => { setPdfPending(null); setStep("menu"); }} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
                  Discard
                </button>
                <button
                  onClick={() => void handleSubmitPending()}
                  disabled={saving || !pdfPending || !negativeMarking.ok}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CircleCheck size={14} />}
                  {saving ? "Saving..." : "Submit assessment"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}