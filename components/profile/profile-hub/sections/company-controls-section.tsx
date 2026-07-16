import type { AnyRecord } from "../shared";

export function CompanyControlsSection({
  company,
  onHoldFreeze,
  onTakedown,
}: {
  company: AnyRecord | null;
  onHoldFreeze: () => void;
  onTakedown: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#000000]">
      <div className="mb-5 border-l-4 border-rose-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Company controls</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
          {company?.status === "taken-down" ? "This company has been taken down." : "No approved members besides you remain in the company. Use these controls carefully."}
        </p>
      </div>
      {company?.status !== "taken-down" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={"rounded-lg border px-4 py-3 text-sm font-semibold " + (company?.status === "frozen" ? "border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-200" : "border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-200")}
            onClick={onHoldFreeze}
          >
            {company?.status === "frozen" ? "Un-freeze Company" : "Hold & Freeze Company"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-200 bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-900 hover:bg-rose-200"
            onClick={onTakedown}
          >
            TakeDown Company
          </button>
        </div>
      ) : null}
    </section>
  );
}
