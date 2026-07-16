import { SectionHeader } from "../shared";

export function DocumentLettersSection({
  onRequestLetter,
  onSendResignation,
}: {
  onRequestLetter: () => void;
  onSendResignation: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#000000]">
      <SectionHeader title="Document Letters" description="Request official company letters or send your resignation" accent="indigo" />
      <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">
        Submit a request to HR for an official document letter or submit your resignation letter.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          type="button"
          onClick={onRequestLetter}
        >
          Request Document Letter
        </button>
        <button
          className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-300 dark:hover:bg-zinc-700"
          type="button"
          onClick={onSendResignation}
        >
          Send Resignation Letter
        </button>
      </div>
    </section>
  );
}
