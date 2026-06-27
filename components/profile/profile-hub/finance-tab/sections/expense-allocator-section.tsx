import { ActionButton, Card, SectionHeader, displayNested } from "../../shared";
import type { AnyRecord } from "../../shared";

export function ExpenseAllocatorSection({
  expenses,
  onStatusUpdate,
}: {
  expenses: AnyRecord[];
  onStatusUpdate: (type: "salary" | "expense" | "budget" | "bill", id: string, status: string, extra?: Record<string, string>) => void;
}) {
  const acceptedExpenses = expenses.filter((e) => String(e.status) === "accepted");
  const disbursedExpenses = expenses.filter((e) => String(e.status) === "disbursed");

  return (
    <Card>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            Expense Allocator
            {acceptedExpenses.length > 0 ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-100 px-1.5 text-[11px] font-bold text-rose-700">
                {acceptedExpenses.length} to disburse
              </span>
            ) : null}
          </span>
        }
        description="Disburse money or hardware for accepted expense requests."
      />
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {acceptedExpenses.length === 0 ? <p className="py-2 text-sm text-slate-500">No accepted expenses ready for disbursement.</p> : null}
        {acceptedExpenses.map((expense) => (
          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2" key={String(expense.id)}>
            <div>
              <p className="text-sm font-medium">{String(expense.title)} x {Number(expense.quantity ?? 1)}</p>
              <p className="text-xs text-slate-500">
                {displayNested(expense.requester, "name", "Member")}{" "}
                <span className="text-[10px] uppercase text-slate-400">({displayNested(expense.requester, "role", "–")})</span> &bull; {String(expense.category)} &bull; Qty: {Number(expense.quantity ?? 1)} &bull; &#x20B9;{Number(expense.amount ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
            <ActionButton variant="approve" className="px-3 py-1.5 text-xs" onClick={() => onStatusUpdate("expense", String(expense.id), "disbursed")}>Disburse</ActionButton>
          </div>
        ))}
      </div>
      {disbursedExpenses.length > 0 ? (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Disbursed</p>
          {disbursedExpenses.map((expense) => (
            <div key={String(expense.id)} className="flex items-center justify-between py-1.5 text-sm">
              <span>
                &#x20B9;{Number(expense.amount ?? 0).toLocaleString("en-IN")} &mdash; {String(expense.title)} x {Number(expense.quantity ?? 1)}{" "}
                <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">disbursed</span>
              </span>
              <div className="ml-2 inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">
                {displayNested(expense.requester, "name", "Member")} ({displayNested(expense.requester, "role", "Member")})
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
