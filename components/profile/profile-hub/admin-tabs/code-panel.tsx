import type { ReactNode } from "react";
import { Building2, Clipboard, Users } from "lucide-react";
import { ActionButton } from "../shared";

export function CodePanel({
  title,
  code,
  label,
  secondaryCodes = [],
  empty,
  showToast,
  children,
}: {
  title: string;
  code?: string;
  label: string;
  secondaryCodes?: { code: string; label: string }[];
  empty: string;
  showToast?: (text: string, type?: "success" | "error") => void;
  children?: ReactNode;
}) {
  const makeJoinUrl = (value: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/join?code=${value}` : value;
  const codes = [code ? { code, label } : null, ...secondaryCodes].filter(Boolean) as { code: string; label: string }[];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Building2 size={18} />
        <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      </div>
      {codes.length > 0 ? (
        <>
          <div className={codes.length > 1 ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
            {codes.map((item) => (
              <div key={item.code}>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">{item.code}</p>
                    <ActionButton aria-label={`Copy ${item.label}`} variant="secondary"
                      onClick={() => { navigator.clipboard.writeText(item.code); showToast?.(`${item.label} copied.`); }}
                      title="Copy code" type="button"><Clipboard size={16} /></ActionButton>
                  </div>
                </div>
                <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200"
                  onClick={() => { navigator.clipboard.writeText(makeJoinUrl(item.code)); showToast?.(`${item.label} join URL copied.`); }} type="button">
                  <Users size={16} /> Copy {item.label} Join URL
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Share this code or join link with your staff.</p>
        </>
      ) : (
        <p className="text-sm text-slate-500">{empty}</p>
      )}
      {children}
    </section>
  );
}
