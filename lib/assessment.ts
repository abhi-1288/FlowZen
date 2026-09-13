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

// Grade answers against the question key. Returns 0-100.
export function computeAssessmentScore(
  answers: Array<{ questionIndex: number; selectedOption: number }>,
  questions: Array<{ correctIndex: number }>
): number {
  if (!questions.length || !answers.length) return 0;
  let correct = 0;
  for (const a of answers) {
    const q = questions[a.questionIndex];
    if (q && q.correctIndex === a.selectedOption) correct++;
  }
  return Math.round((correct / questions.length) * 100);
}