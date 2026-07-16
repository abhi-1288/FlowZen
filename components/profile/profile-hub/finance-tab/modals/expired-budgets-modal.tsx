import { ActionButton, displayNested } from "../../shared";
import type { AnyRecord } from "../../shared";
import { isExpiredDeadline, parseDeadline } from "../helpers";

const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-black/40";
const modalClass = "w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl";

export function ExpiredBudgetsModal({
  show,
  budgets,
  onClose,
}: {
  show: boolean;
  budgets: AnyRecord[];
  onClose: () => void;
}) {
  if (!show) return null;

  const expiredBudgets = budgets.filter((b) => isExpiredDeadline(parseDeadline(b)));

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">Expired Budgets</h4>
          <ActionButton variant="ghost" onClick={onClose}>Close</ActionButton>
        </div>
        <div className="mt-4 divide-y divide-slate-200">
          {expiredBudgets.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">No expired budgets.</p>
          ) : null}
          {budgets.map((budget) => {
            const deadline = parseDeadline(budget);
            if (!isExpiredDeadline(deadline)) return null;
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(budget.id)}>
                <div>
                  <p className="font-medium">{displayNested(budget.board, "title", "Board")}</p>
                  <p className="text-sm text-slate-500">
                    Total: &#x20B9;{Number(budget.totalBudget ?? 0).toLocaleString("en-IN")}
                    {budget.deadline ? <> &bull; Deadline: {new Date(String(budget.deadline)).toLocaleDateString()}</> : null}
                    {budget.decidedBy ? <> &bull; Set by: {displayNested(budget.decidedBy, "name", "User")}</> : null}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
