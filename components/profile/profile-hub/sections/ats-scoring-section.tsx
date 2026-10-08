import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Sparkles } from "lucide-react";
import type { AtsSettingsState } from "../hooks/use-ats-settings";

const cardBase = "rounded-lg border border-[var(--c-border-light)] dark:border-zinc-800 p-4";
const inputBase =
  "mt-1 w-full rounded-lg border border-[var(--c-border-light)] dark:border-zinc-800 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500";

export function AtsScoringSection({ state }: { state: AtsSettingsState }) {
  const [reveal, setReveal] = useState(false);

  return (
    <section className="rounded-xl neu-card p-5">
      <div className="mb-5 border-l-4 border-violet-500 pl-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Sparkles size={18} className="text-violet-600" /> ATS Resume Scoring
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Choose the AI model used to score candidate resumes. Applies to every job in this company.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`block ${cardBase}`}>
          <span className="text-sm font-semibold text-slate-900">Provider</span>
          <select
            value={state.provider}
            onChange={(e) => state.setProvider(e.target.value === "gemini" ? "gemini" : "openrouter")}
            className={inputBase}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="gemini">Google Gemini</option>
          </select>
          <span className="mt-1.5 block text-xs text-slate-500">
            {state.provider === "openrouter"
              ? "Free models via OpenRouter (e.g. the free router below)."
              : "Google AI Studio API key."}
          </span>
        </label>

        <label className={`block ${cardBase}`}>
          <span className="text-sm font-semibold text-slate-900">Model name</span>
          <input
            value={state.model}
            onChange={(e) => state.setModel(e.target.value)}
            placeholder={state.defaults[state.provider]}
            className={inputBase}
          />
          <span className="mt-1.5 block text-xs text-slate-500">
            Leave blank to use <span className="font-medium">{state.defaults[state.provider]}</span>.
          </span>
        </label>
      </div>

      <div className={`mt-4 ${cardBase}`}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-violet-100 p-2.5">
            <KeyRound size={18} className="text-violet-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">API key</p>
            {state.editingKey ? (
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type={reveal ? "text" : "password"}
                  value={state.apiKeyDraft}
                  onChange={(e) => state.setApiKeyDraft(e.target.value)}
                  placeholder={state.provider === "gemini" ? "AIza..." : "sk-or-v1-..."}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--c-border-light)] dark:border-zinc-800 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  className="rounded-md border border-[var(--c-border-light)] p-2 text-slate-500 hover:bg-[var(--c-bg-muted)] dark:border-zinc-800"
                  title={reveal ? "Hide" : "Reveal"}
                >
                  {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  onClick={state.cancelEditingKey}
                  className="rounded-md border border-[var(--c-border-light)] px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-[var(--c-bg-muted)] dark:border-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-[var(--c-bg-muted)] px-3 py-2 text-xs text-slate-600 dark:text-zinc-300">
                  {state.hasApiKey ? state.maskedApiKey : "No API key set"}
                </code>
                <button
                  type="button"
                  onClick={state.startEditingKey}
                  className="shrink-0 rounded-md border border-[var(--c-border-light)] px-3 py-2 text-xs font-medium text-slate-600 hover:bg-[var(--c-bg-muted)] dark:border-zinc-800 dark:text-zinc-300"
                >
                  {state.hasApiKey ? "Change" : "Add key"}
                </button>
              </div>
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              The key is saved on the server and only ever shown masked. Clearing it here removes it.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          Free OpenRouter models allow ~50 requests/day (1,000 after a one-time $10 top-up).
        </p>
        <button
          type="button"
          onClick={() => void state.save()}
          disabled={state.saving || !state.loaded}
          className="neu-btn neu-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {state.saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {state.saving ? "Saving..." : "Save"}
        </button>
      </div>
    </section>
  );
}
