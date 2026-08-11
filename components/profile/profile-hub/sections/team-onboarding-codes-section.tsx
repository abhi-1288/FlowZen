import { Copy, Users } from "lucide-react";
import type { AnyRecord } from "../shared";

export function TeamOnboardingCodesSection({
  managerTeams,
  showToast,
}: {
  managerTeams: AnyRecord[];
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  return (
    <section className="rounded-xl border overflow-y-auto h-auto max-h-[500px] border-[var(--c-border-light)] bg-[var(--c-bg-card)] p-5 dark:border-zinc-800 dark:bg-[#000000]">
      <div className="mb-5 border-l-4 border-cyan-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Team Onboarding Codes</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">Share these codes with new team members</p>
      </div>
      {managerTeams.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Create a team to generate employee onboarding codes.</p>
      ) : (
        <div className="space-y-3">
          {managerTeams.map((teamItem) => {
            const code = String(teamItem.joinCode ?? "");
            const otherCode = String(teamItem.otherJoinCode ?? "");
            const teamName = String(teamItem.name ?? "Team");
            return (
              <div key={String(teamItem.id)} className="rounded-lg border border-[var(--c-border-light)] p-4 dark:border-zinc-800">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">{teamName}</p>
                  <span className="text-xs text-slate-500 dark:text-zinc-400">{Number(teamItem.employeeCount ?? 0)} employees</span>
                </div>
                {[
                  { code, label: "Team code" },
                  ...(otherCode ? [{ code: otherCode, label: "Others code" }] : []),
                ].map((item) => (
                  <div className="mb-3 last:mb-0" key={item.code}>
                    <div className="rounded-lg border border-dashed border-slate-300 bg-[var(--c-bg-muted)] p-3 dark:border-zinc-700 dark:bg-[#161616]">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-400">{item.label}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700 dark:text-indigo-300">{item.code}</p>
                        <button
                          aria-label={`Copy ${teamName} ${item.label}`}
                          className="grid h-9 w-9 place-items-center rounded-lg neu-card text-slate-700 hover:bg-[var(--c-bg-muted)] dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-300 dark:hover:bg-zinc-700"
                          onClick={() => { navigator.clipboard.writeText(item.code); showToast(`${teamName} ${item.label.toLowerCase()} copied.`); }}
                          title="Copy code"
                          type="button"
                        >
                          <Copy size={20} />
                        </button>
                      </div>
                    </div>
                    <button
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50"
                      onClick={() => { const joinUrl = `${window.location.origin}/join?code=${item.code}`; navigator.clipboard.writeText(joinUrl); showToast(`${teamName} ${item.label.toLowerCase()} join URL copied.`); }}
                      type="button"
                    >
                      <Users size={16} />
                      Copy {item.label} Join URL
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
