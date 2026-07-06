import { ActionButton, displayNested } from "../../shared";
import type { AnyRecord } from "../../shared";
import { isExpiredDeadline, parseDeadline } from "../helpers";

export function BudgetListSection({
  budgets,
  actorRole,
  profileId,
  onEdit,
  onApprove,
  onReject,
  onViewExpired,
}: {
  budgets: AnyRecord[];
  actorRole: string;
  profileId: string;
  onEdit: (budget: AnyRecord) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, type: "expense" | "budget") => void;
  onViewExpired: () => void;
}) {
  const pendingCount = budgets.filter((b) => String(b.status) === "pending").length;
  const activeBudgets = budgets.filter((b) => !isExpiredDeadline(parseDeadline(b)));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <div className="mb-5 border-l-4 border-violet-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">
          Allocated Budgets
          {pendingCount > 0 ? (
            <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{pendingCount} pending</span>
          ) : null}
        </h3>
        {actorRole === "finance" ? (
          <button className="text-sm text-[var(--color-primary)] underline" onClick={onViewExpired}>View expired budgets</button>
        ) : null}
      </div>
      <div className="mt-4 divide-y divide-slate-200">
        {activeBudgets.map((budget) => {
          const budgetStatus = String(budget.status ?? "pending");
          const budgetAssignedTo = (budget.assignedTo as AnyRecord)?._id ?? (budget.assignedTo as AnyRecord)?.id ?? "";
          const isPendingForMe = (actorRole === "finance" && String(budgetAssignedTo) === profileId && budgetStatus === "pending") || (actorRole === "admin" && !budget.assignedTo && budgetStatus === "pending");
          return (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={String(budget.id)}>
              <div>
                <p className="font-medium">{displayNested(budget.board, "title", "Board")}</p>
                <p className="text-sm text-slate-500">
                  Total: &#x20B9;{Number(budget.totalBudget ?? 0).toLocaleString("en-IN")}
                  {Number(budget.teamSpendingLimit ?? 0) > 0 ? <> &bull; Team limit: &#x20B9;{Number(budget.teamSpendingLimit).toLocaleString("en-IN")}</> : null}
                  {Number(budget.resourceBudget ?? 0) > 0 ? <> &bull; Resource: &#x20B9;{Number(budget.resourceBudget).toLocaleString("en-IN")}</> : null}
                  {budget.deadline ? <> &bull; Deadline: {new Date(String(budget.deadline)).toLocaleDateString()}</> : null}
                  {budget.decidedBy ? <> &bull; By: {displayNested(budget.decidedBy, "name", "User")}</> : null}
                </p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${budgetStatus === "approved" ? "bg-emerald-100 text-emerald-700" : budgetStatus === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                  {budgetStatus}
                </span>
              </div>
              <div className="flex gap-2">
                <ActionButton variant="secondary" className="px-3" onClick={() => onEdit(budget)}>Edit</ActionButton>
                {isPendingForMe ? (
                  <>
                    <ActionButton variant="approve" className="px-3" onClick={() => onApprove(String(budget.id))}>Approve</ActionButton>
                    <ActionButton variant="danger" className="px-3" onClick={() => onReject(String(budget.id), "budget")}>Reject</ActionButton>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {activeBudgets.length === 0 ? <p className="py-4 text-sm text-slate-500">No budgets allocated yet.</p> : null}
      </div>
    </section>
  );
}
