import { SectionHeader } from "../shared";

export function DocumentLettersSection({
  onRequestLetter,
  onSendResignation,
}: {
  onRequestLetter: () => void;
  onSendResignation: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Document Letters" description="Request official company letters or send your resignation" accent="indigo" />
      <p className="mt-4 text-sm text-slate-600">
        Submit a request to HR for an official document letter or submit your resignation letter.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          type="button"
          onClick={onRequestLetter}
        >
          Request Document Letter
        </button>
        <button
          className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={onSendResignation}
        >
          Send Resignation Letter
        </button>
      </div>
    </section>
  );
}
