import { Clock } from "lucide-react";

export function TimelineTab({
  items,
  role,
}: {
  items: { title: string; body: string; date?: string }[];
  role: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-5 border-l-4 border-slate-400 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Role Timeline</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Lifecycle events for your {role} account.
        </p>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const when = item.date ? new Date(item.date) : null;
          return (
            <div
              className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              key={`${item.title}-${item.date}`}
            >
              <div className="flex min-w-0 gap-3">
                <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm">
                  <Clock size={14} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.body}</p>
                </div>
              </div>
              {when ? (
                <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-left ring-1 ring-slate-100 sm:text-right">
                  <p className="text-sm font-medium text-slate-700">{when.toLocaleDateString()}</p>
                  <p className="text-xs text-slate-400">{when.toLocaleTimeString()}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
