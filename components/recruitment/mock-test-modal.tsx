"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * HR configuration for a job's mock test.
 *
 * Deliberately a separate modal from the assessment manager rather than another
 * step inside it: a mock test is optional, schedulable on its own timetable, and
 * has nothing to do with the question bank beyond drawing from it. Opening this
 * never touches a question, the pass score or the real proctoring settings.
 *
 * Everything the candidate will experience is shown back to HR as it is typed —
 * the real last-entry time, the real paper length — because a window that
 * silently admits nobody is the easiest way to ship a mock that no one can sit.
 */

type Props = {
  jobId: string;
  onClose: () => void;
  /** Total questions in the bank, used to explain the sampled paper length. */
  totalQuestions: number;
};

type AttemptRow = {
  attemptNumber: number;
  startedAt: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  inProgress: boolean;
  score: number | null;
  passed: boolean | null;
  questionCount: number;
};

type CandidateRow = {
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  attemptsUsed: number;
  bestScore: number | null;
  rows: AttemptRow[];
};

type Payload = {
  mockTest: {
    enabled: boolean;
    opensAt: string | null;
    closesAt: string | null;
    durationMinutes: number | null;
    questionPercent: number;
    shuffleQuestions: boolean;
    resultRelease: "immediate" | "delayed" | "never";
    resultDelayHours: number;
    showAnswerKey: boolean;
    maxAttempts: number;
    lastInvitedAt: string | null;
  };
  window: {
    phase: string;
    opensAt: string | null;
    closesAt: string | null;
    lastEntryAt: string | null;
    durationMinutes: number | null;
  };
  pool: {
    total: number;
    /** False when there is nothing to sample; the modal explains it in place. */
    ready?: boolean;
    general: number;
    domains: { name: string; questions: number }[];
    sampleSize: number;
  };
  job: { assessmentDurationMinutes: number | null };
  cohort: { eligible: number; invited: number; attempted: number };
  attempts: CandidateRow[];
};

type Form = {
  enabled: boolean;
  opensAt: string;
  closesAt: string;
  durationMinutes: string;
  questionPercent: string;
  shuffleQuestions: boolean;
  resultRelease: "immediate" | "delayed" | "never";
  resultDelayHours: string;
  showAnswerKey: boolean;
  maxAttempts: string;
};

/** ISO -> the "YYYY-MM-DDTHH:mm" a datetime-local input expects, in UTC. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

/** The datetime-local value -> epoch ms, read as UTC to match the slot convention. */
function toLocalMs(value: string): number | null {
  if (!value) return null;
  const ms = new Date(`${value}:00.000Z`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** The datetime-local value -> ISO. */
function fromLocalInput(value: string): string | null {
  const ms = toLocalMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

function formatMoment(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PHASE_COPY: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Not open yet", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" },
  open: { label: "Open", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  "entry-closed": {
    label: "Closed to new entries",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  expired: { label: "Finished", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" },
  unusable: { label: "Needs attention", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  disabled: { label: "Off", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" },
};

const labelCls = "block text-sm font-medium text-slate-700 dark:text-zinc-200";
const hintCls = "mt-1 text-xs text-slate-500 dark:text-zinc-400";
const inputCls =
  "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const cardCls = "rounded-lg border border-slate-200 p-4 dark:border-zinc-800";

export function MockTestModal({ jobId, onClose, totalQuestions }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetting, setResetting] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment/mock-test`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load the mock test settings.");
        return;
      }
      setData(json as Payload);
      setForm({
        enabled: Boolean(json.mockTest.enabled),
        opensAt: toLocalInput(json.mockTest.opensAt),
        closesAt: toLocalInput(json.mockTest.closesAt),
        durationMinutes:
          json.mockTest.durationMinutes != null
            ? String(json.mockTest.durationMinutes)
            : json.job.assessmentDurationMinutes != null
              ? String(json.job.assessmentDurationMinutes)
              : "60",
        questionPercent: String(json.mockTest.questionPercent ?? 10),
        shuffleQuestions: json.mockTest.shuffleQuestions !== false,
        resultRelease: json.mockTest.resultRelease ?? "immediate",
        resultDelayHours: String(json.mockTest.resultDelayHours ?? 0),
        showAnswerKey: json.mockTest.showAnswerKey !== false,
        maxAttempts: String(json.mockTest.maxAttempts ?? 1),
      });
    } catch {
      setError("Could not load the mock test settings.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  // Captured once at mount: the phase chip only needs to know where "now" sat
  // relative to the window being typed, and a stable value keeps the render
  // pure and stops the chip flickering while the form is open.
  const [mountedAtMs] = useState(() => Date.now());

  // Nothing to sample means nothing to offer: an enabled mock over an empty bank
  // would send an invitation that every candidate then fails to open. The window
  // and attempt limit stay editable so HR can still configure ahead of time, but
  // the switch is held until the bank exists.
  //
  // The effective flag, not the stored one, drives the whole form. Otherwise a
  // mock enabled before the bank was emptied would render as a checked but
  // disabled box and block its own save, leaving HR unable to change anything.
  const poolReady = (data?.pool.total ?? totalQuestions) > 0;
  const effectiveEnabled = poolReady ? Boolean(form?.enabled) : false;
  const canSave = !loading && Boolean(form);

  /**
   * Mirror of the server's window maths, purely so HR sees the real last-entry
   * time while typing. The server recomputes all of it and is the only thing
   * that decides whether a candidate may start.
   */
  const preview = useMemo<{ phase: string; lastEntry: string | null; minutes: number | null } | null>(() => {
    if (!form) return null;
    const opensMs = toLocalMs(form.opensAt);
    const closesMs = toLocalMs(form.closesAt);
    const minutes = Number(form.durationMinutes);
    if (!effectiveEnabled) return { phase: "disabled", lastEntry: null, minutes: null };
    if (!opensMs || !closesMs || closesMs <= opensMs) {
      return { phase: "unusable", lastEntry: null, minutes: null };
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return { phase: "unusable", lastEntry: null, minutes: null };
    }
    if (closesMs - opensMs < minutes * 60_000) {
      return { phase: "unusable", lastEntry: null, minutes: null };
    }
    const lastEntry = closesMs - minutes * 60_000;
    const now = mountedAtMs;
    const phase =
      now < opensMs ? "scheduled" : now >= closesMs ? "expired" : now > lastEntry ? "entry-closed" : "open";
    return { phase, lastEntry: new Date(lastEntry).toISOString(), minutes };
  }, [form, mountedAtMs, effectiveEnabled]);

  const sampleSize = useMemo(() => {
    const total = data?.pool.total ?? totalQuestions;
    const pct = Number(form?.questionPercent ?? 10);
    if (!Number.isFinite(total) || total <= 0) return 0;
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    const wanted = pct >= 100 ? total : Math.max(1, Math.ceil((total * pct) / 100));
    return Math.min(wanted, total, 200);
  }, [data, form, totalQuestions]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment/mock-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: effectiveEnabled,
          opensAt: fromLocalInput(form.opensAt),
          closesAt: fromLocalInput(form.closesAt),
          durationMinutes: form.durationMinutes === "" ? null : Number(form.durationMinutes),
          questionPercent: Number(form.questionPercent),
          shuffleQuestions: form.shuffleQuestions,
          resultRelease: form.resultRelease,
          resultDelayHours: Number(form.resultDelayHours),
          showAnswerKey: form.showAnswerKey,
          maxAttempts: Number(form.maxAttempts),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not save the mock test.");
        return;
      }
      setNotice("Mock test saved.");
      await load();
    } catch {
      setError("Could not save the mock test.");
    } finally {
      setSaving(false);
    }
  }

  async function resetAttempt(candidateId: string) {
    setResetting(candidateId);
    setError("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/assessment/mock-test/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not reset the attempt.");
        return;
      }
      setNotice(`Cleared the mock attempt for ${json.candidate?.firstName ?? "the candidate"}.`);
      setConfirmReset(null);
      await load();
    } catch {
      setError("Could not reset the attempt.");
    } finally {
      setResetting(null);
    }
  }

  const phaseInfo = PHASE_COPY[preview?.phase ?? "disabled"] ?? PHASE_COPY.disabled;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 px-4 py-8">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-soft dark:bg-[#000000]">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Mock Test</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              A short practice paper from the same questions. Results never count towards the candidate.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading || !form ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-zinc-400">
            {loading ? "Loading…" : "The mock test could not be loaded."}
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
            {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
            {notice && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}

            {!poolReady && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <strong>No questions in the bank yet.</strong> The mock test samples from the same
                questions as the real assessment, so add them under <strong>Manage Assessment</strong> first.
                You can still set the window and attempt limit now and switch it on afterwards.
              </p>
            )}

            {/* Enable */}
            <label className={`flex items-start gap-3 ${poolReady ? "" : "opacity-60"}`}>
              <input
                type="checkbox"
                checked={effectiveEnabled}
                disabled={!poolReady}
                onChange={(e) => set("enabled", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
              />
              <span>
                <span className={labelCls}>Offer a mock test</span>
                <span className={hintCls}>
                  {poolReady
                    ? "Eligible candidates are emailed and get a practice card in their portal."
                    : "Unavailable until there are questions to sample."}
                </span>
              </span>
            </label>

            {effectiveEnabled && (
              <>
                {/* Window */}
                <div className={cardCls}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="mock-opens">Opens at</label>
                      <input
                        id="mock-opens"
                        type="datetime-local"
                        value={form.opensAt}
                        onChange={(e) => set("opensAt", e.target.value)}
                        className={inputCls}
                      />
                      <p className={hintCls}>Times are saved in UTC, as with the real assessment.</p>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="mock-closes">Closes at</label>
                      <input
                        id="mock-closes"
                        type="datetime-local"
                        value={form.closesAt}
                        onChange={(e) => set("closesAt", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="mock-duration">Time limit (minutes)</label>
                      <input
                        id="mock-duration"
                        type="number"
                        min={1}
                        max={600}
                        value={form.durationMinutes}
                        onChange={(e) => set("durationMinutes", e.target.value)}
                        className={inputCls}
                      />
                      <p className={hintCls}>
                        Default {data?.job.assessmentDurationMinutes ?? 60} min, the assessment&apos;s limit.
                      </p>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="mock-attempts">Attempts per candidate</label>
                      <input
                        id="mock-attempts"
                        type="number"
                        min={1}
                        max={5}
                        value={form.maxAttempts}
                        onChange={(e) => set("maxAttempts", e.target.value)}
                        className={inputCls}
                      />
                      <p className={hintCls}>Their best score is the one shown.</p>
                    </div>
                  </div>

                  {/* Live preview of the rule the server enforces, so the
                      "everyone can finish before it shuts" constraint is
                      visible rather than discovered on the day. */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-zinc-900">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${phaseInfo.cls}`}>{phaseInfo.label}</span>
                    <span className="text-slate-600 dark:text-zinc-400">
                      Opens {formatMoment(fromLocalInput(form.opensAt))}
                    </span>
                    <span className="text-slate-600 dark:text-zinc-400">
                      · Closes {formatMoment(fromLocalInput(form.closesAt))}
                    </span>
                    {preview?.lastEntry && (
                      <span className="text-slate-600 dark:text-zinc-400">
                        · Last entry {formatMoment(preview.lastEntry)}
                      </span>
                    )}
                  </div>
                  {preview?.phase === "unusable" && (
                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                      The window is shorter than the time limit, so nobody could finish before it closes.
                    </p>
                  )}
                </div>

                {/* Paper */}
                <div className={cardCls}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="mock-percent">Questions per paper (%)</label>
                      <input
                        id="mock-percent"
                        type="number"
                        min={5}
                        max={100}
                        step={5}
                        value={form.questionPercent}
                        onChange={(e) => set("questionPercent", e.target.value)}
                        className={inputCls}
                      />
                      <p className={hintCls}>
                        Taken from the general questions plus the candidate&apos;s own domain, at least one question.
                      </p>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-start gap-3 pb-2">
                        <input
                          type="checkbox"
                          checked={form.shuffleQuestions}
                          onChange={(e) => set("shuffleQuestions", e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                          <span className={labelCls}>Shuffle question order</span>
                          <span className={hintCls}>Different candidates get a different order.</span>
                        </span>
                      </label>
                    </div>
                  </div>
                  {poolReady ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                      With {data?.pool.total ?? totalQuestions} questions in the bank this is roughly{" "}
                      <span className="font-semibold text-slate-700 dark:text-zinc-200">{sampleSize} questions</span>{" "}
                      per paper. Each candidate gets their own set, and it does not change if they reload.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                      The paper size is worked out from the bank, so there is nothing to estimate yet.
                    </p>
                  )}
                </div>

                {/* Release */}
                <div className={cardCls}>
                  <span className={labelCls}>Show the result and answer key</span>
                  <div className="mt-2 space-y-2">
                    {(
                      [
                        { value: "immediate", label: "Straight after submitting" },
                        { value: "delayed", label: "A fixed time after submitting" },
                        { value: "never", label: "Never — only you can see it" },
                      ] as const
                    ).map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-200">
                        <input
                          type="radio"
                          name="mock-release"
                          checked={form.resultRelease === opt.value}
                          onChange={() => set("resultRelease", opt.value)}
                          className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  {form.resultRelease === "delayed" && (
                    <div className="mt-3 max-w-xs">
                      <label className={labelCls} htmlFor="mock-delay">Hours after submitting</label>
                      <input
                        id="mock-delay"
                        type="number"
                        min={0}
                        max={720}
                        value={form.resultDelayHours}
                        onChange={(e) => set("resultDelayHours", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  )}

                  <label className="mt-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.showAnswerKey}
                      onChange={(e) => set("showAnswerKey", e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      <span className={labelCls}>Include the answer key</span>
                      <span className={hintCls}>Otherwise they see their score without the correct answers.</span>
                    </span>
                  </label>

                  {form.resultRelease === "never" && (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                      Withholding the result does not hide it from you — it is in the list below, and the candidate
                      simply never sees it.
                    </p>
                  )}
                </div>

                {/* Attempts so far */}
                <div className={cardCls}>
                  <div className="flex items-baseline justify-between">
                    <span className={labelCls}>Who has taken it</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      {data?.cohort.attempted ?? 0} of {data?.cohort.eligible ?? 0} eligible
                      {data?.mockTest.lastInvitedAt
                        ? ` · emailed ${formatMoment(data.mockTest.lastInvitedAt)}`
                        : " · not emailed yet"}
                    </span>
                  </div>

                  {!data?.attempts?.length ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                      Nobody has started a mock test yet.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100 dark:divide-zinc-800">
                      {data.attempts.map((row) => (
                        <li key={row.candidateId} className="flex items-center gap-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-900 dark:text-zinc-100">
                              {row.firstName} {row.lastName}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                              {row.rows
                                .map(
                                  (a) =>
                                    `${a.attemptNumber}: ${
                                      a.inProgress
                                        ? "in progress"
                                        : a.score == null
                                          ? "not graded"
                                          : `${a.score}%${a.passed === false ? " (below pass mark)" : ""}`
                                    }${a.autoSubmitted ? " auto" : ""}`
                                )
                                .join(" · ")}
                            </p>
                          </div>
                          {confirmReset === row.candidateId ? (
                            <span className="flex items-center gap-1.5">
                              <button
                                onClick={() => void resetAttempt(row.candidateId)}
                                disabled={resetting === row.candidateId}
                                className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                              >
                                {resetting === row.candidateId ? "Clearing…" : "Confirm"}
                              </button>
                              <button
                                onClick={() => setConfirmReset(null)}
                                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmReset(row.candidateId)}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              Reset
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                    Reset clears their mock attempts and puts them back in the next email run. It cannot touch their
                    real assessment.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Close
          </button>
          <button
            onClick={() => void save()}
            disabled={!canSave || saving}
            className="rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save mock test"}
          </button>
        </div>
      </div>
    </div>
  );
}
