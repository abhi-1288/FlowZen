import type { FormEvent } from "react";
import { ActionButton } from "../shared";

export function JoinPanel({
  title,
  placeholder,
  value,
  onChange,
  onSubmit,
  status,
  onCancelRequest,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  status?: string;
  onCancelRequest?: () => void;
}) {
  const isPending = String(status ?? "") === "pending";
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <div className="mb-5 border-l-4 border-sky-400 pl-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-sm text-slate-500">Enter the code and wait for approval.</p>
      </div>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <input className="w-full rounded-lg border border-slate-200 px-3 py-2.5" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
        <ActionButton variant="primary" className="w-full" disabled={isPending}>{isPending ? "Requested" : "Request approval"}</ActionButton>
      </form>
      {isPending && onCancelRequest ? (
        <ActionButton variant="secondary" className="mt-2 w-full" type="button" onClick={onCancelRequest}>Cancel Request</ActionButton>
      ) : null}
      {status && status !== "none" ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Current status: {status}</p>
      ) : null}
    </section>
  );
}
