// Build the flattened question list delivered to a candidate: general (non-domain)
// questions first, then the questions of the candidate's chosen domain (if any).
// Order is deterministic and MUST match the order used at /start.
export function buildAssessmentQuestions(
  general: Array<{ type?: string; correctIndex?: number; marks?: number; required?: boolean }>,
  domainQuestions: Array<{ type?: string; correctIndex?: number; marks?: number; required?: boolean }> = []
): Array<{ type: string; correctIndex: number; marks: number; required: boolean }> {
  return [...general, ...domainQuestions].map((q) => ({
    type: q.type === "essay" ? "essay" : "mcq",
    correctIndex: q.correctIndex ?? 0,
    marks: Math.max(0, Number(q.marks) || 1),
    required: Boolean(q.required),
  }));
}

// Find the chosen domain object; returns null when the assessment has no domains.
export function pickDomain(
  domains: Array<{ name: string; questions?: Array<Record<string, unknown>> }>,
  domainName?: string | null
): { name: string; questions: Array<Record<string, unknown>> } | null {
  if (!domains || !domains.length) return null;
  const target = (domainName || "").trim();
  const found = domains.find((d) => d.name.trim().toLowerCase() === target.toLowerCase());
  if (!found) return null;
  return { name: found.name, questions: found.questions || [] };
}

// Whether the online assessment can currently be started (the assessment date's calendar day).
export function assessmentIsOpen(
  opts: { assessment?: boolean; assessmentDate?: Date | string | null },
  now: Date = new Date()
): boolean {
  if (!opts?.assessment || !opts.assessmentDate) return false;
  const date = new Date(opts.assessmentDate);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
}

// Whether assessment results/apply are unlocked (assessment date + 1 day, i.e. next calendar day >= date).
export function assessmentResultsUnlocked(
  opts: { assessment?: boolean; assessmentDate?: Date | string | null },
  now: Date = new Date()
): boolean {
  if (!opts?.assessment || !opts.assessmentDate) return false;
  const date = new Date(opts.assessmentDate);
  if (Number.isNaN(date.getTime())) return false;
  const unlock = new Date(date);
  unlock.setDate(unlock.getDate() + 1);
  unlock.setHours(0, 0, 0, 0);
  return now >= unlock;
}

// Grade answers against the question key with per-question marks and an optional
// global negative-marking value. Returns 0-100 (clamped) plus raw mark details.
// Essays are never auto-scored: wrong formats are ignored, they are marked for manual review.
export function computeAssessmentScore(
  answers: Array<{ questionIndex: number; selectedOption?: number; textAnswer?: string }>,
  questions: Array<{ type?: string; correctIndex?: number; marks?: number; required?: boolean }>,
  negativeMarking: number = 0
): {
  score: number;
  rawMarks: number;
  maxMarks: number;
  correct: number;
  wrong: number;
  mcqTotal: number;
  essayCount: number;
  hasEssays: boolean;
} {
  const neg = Math.max(0, Number(negativeMarking) || 0);
  let rawMarks = 0;
  let maxMarks = 0;
  let correct = 0;
  let wrong = 0;
  let mcqTotal = 0;
  let essayCount = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q?.type === "essay") {
      essayCount++;
      continue;
    }
    const marks = Math.max(0, Number(q?.marks) || 1);
    maxMarks += marks;
    mcqTotal++;
    const a = answers.find((x) => x.questionIndex === i);
    if (a && a.selectedOption != null && a.selectedOption === q?.correctIndex) {
      correct++;
      rawMarks += marks;
    } else if (a && a.selectedOption != null) {
      wrong++;
      rawMarks -= neg;
    }
  }
  return {
    score: maxMarks > 0 ? Math.max(0, Math.round((rawMarks / maxMarks) * 100)) : 0,
    rawMarks,
    maxMarks,
    correct,
    wrong,
    mcqTotal,
    essayCount,
    hasEssays: essayCount > 0,
  };
}