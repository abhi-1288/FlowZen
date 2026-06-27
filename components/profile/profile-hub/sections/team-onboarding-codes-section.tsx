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
    <section className="rounded-2xl border overflow-y-auto h-auto max-h-[500px] border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <div className="mb-5 border-l-4 border-cyan-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Team Onboarding Codes</h3>
        <p className="mt-0.5 text-sm text-slate-500">Share these codes with new team members</p>
      </div>
      {managerTeams.length === 0 ? (
        <p className="text-sm text-slate-500">Create a team to generate employee onboarding codes.</p>
      ) : (
        <div className="space-y-3">
          {managerTeams.map((teamItem) => {
            const code = String(teamItem.joinCode ?? "");
            const otherCode = String(teamItem.otherJoinCode ?? "");
            const teamName = String(teamItem.name ?? "Team");
            return (
              <div key={String(teamItem.id)} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">{teamName}</p>
                  <span className="text-xs text-slate-500">{Number(teamItem.employeeCount ?? 0)} employees</span>
                </div>
                {[
                  { code, label: "Team code" },
                  ...(otherCode ? [{ code: otherCode, label: "Others code" }] : []),
                ].map((item) => (
                  <div className="mb-3 last:mb-0" key={item.code}>
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">{item.code}</p>
                        <button
                          aria-label={`Copy ${teamName} ${item.label}`}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          onClick={() => { navigator.clipboard.writeText(item.code); showToast(`${teamName} ${item.label.toLowerCase()} copied.`); }}
                          title="Copy code"
                          type="button"
                        >
                          <Copy size={20} />
                        </button>
                      </div>
                    </div>
                    <button
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200"
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
