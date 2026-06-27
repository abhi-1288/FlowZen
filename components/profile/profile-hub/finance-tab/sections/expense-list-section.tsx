import { ActionButton, Card, SectionHeader, displayNested } from "../../shared";
import type { AnyRecord } from "../../shared";

export function ExpenseListSection({
  expenses,
  actorRole,
  profileId,
  adminOptions,
  forwardAdminByExpense,
  onForwardAdmin,
  onReject,
  onStatusUpdate,
}: {
  expenses: AnyRecord[];
  actorRole: string;
  profileId: string;
  adminOptions: AnyRecord[];
  forwardAdminByExpense: Record<string, string>;
  onForwardAdmin: (id: string, adminId: string) => void;
  onReject: (id: string, type: "expense" | "budget") => void;
  onStatusUpdate: (type: "salary" | "expense" | "budget" | "bill", id: string, status: string, extra?: Record<string, string>) => void;
}) {
  const pendingCount = expenses.filter((e) => ["pending", "forwarded"].includes(String(e.status ?? ""))).length;

  return (
    <Card>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            My Expense Requests
            {expenses.length > 0 ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-100 px-1.5 text-[11px] font-bold text-rose-700">{expenses.length}</span>
            ) : null}
            {pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {pendingCount} pending
              </span>
            ) : null}
          </span>
        }
        description="Track and manage your expense submissions"
      />
      <div className="mt-4 divide-y divide-slate-200">
        {expenses.map((expense) => {
          const expenseId = String(expense.id);
          const assignedToId = expense.assignedTo ? String((expense.assignedTo as AnyRecord)._id ?? (expense.assignedTo as AnyRecord).id ?? "") : "";
          const adminApproverId = expense.adminApprover ? String((expense.adminApprover as AnyRecord)._id ?? (expense.adminApprover as AnyRecord).id ?? "") : "";
          const isAssignedToMe = assignedToId === String(profileId);
          const isAssignedAdmin = adminApproverId === String(profileId);
          const noAssignment = !expense.assignedTo;
          const expStatus = String(expense.status);

          const canForward = actorRole === "finance" && expStatus === "pending" && isAssignedToMe;
          const canAdminApprove = actorRole === "admin" && ((expStatus === "forwarded" && isAssignedAdmin) || (expStatus === "pending" && noAssignment));
          const canAccept = actorRole === "finance" && expStatus === "approved" && (noAssignment || isAssignedToMe);

          return (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={expenseId}>
              <div>
                <p className="font-medium">{String(expense.title)} x {Number(expense.quantity ?? 1)} - ₹{Number(expense.amount ?? 0).toLocaleString("en-IN")}</p>
                <p className="text-sm text-slate-500">
                  {displayNested(expense.requester, "name", "Requester")} • {String(expense.category)} • <span className={expStatus === "accepted" ? "text-amber-600 font-semibold" : ""}>{String(expense.status)}{expStatus === "accepted" ? " (Not Disbursed)" : ""}</span>
                  {expense.assignedTo ? <> • Assigned: {displayNested(expense.assignedTo, "name", "Finance")}</> : null}
                  {expense.forwardedBy ? <> • Forwarded: {displayNested(expense.forwardedBy, "name", "Finance")}</> : null}
                  {expense.rejectionReason ? <> • Reason: {String(expense.rejectionReason)}</> : null}
                  {expense.adminApprover ? <> • Admin: {displayNested(expense.adminApprover, "name", "Admin")}</> : null}
                  {expense.acceptedBy ? <> • Accepted: {displayNested(expense.acceptedBy, "name", "Finance")}</> : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canForward ? (
                  <>
                    <ActionButton variant="danger" className="px-3" onClick={() => onReject(expenseId, "expense")}>Reject</ActionButton>
                    <select
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      value={forwardAdminByExpense[expenseId] ?? ""}
                      onChange={(e) => onForwardAdmin(expenseId, e.target.value)}
                    >
                      <option value="">Select admin</option>
                      {adminOptions.map((admin) => (
                        <option key={String(admin.id)} value={String(admin.id)}>{String(admin.name ?? admin.email ?? "Admin")}</option>
                      ))}
                    </select>
                    <button
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={!forwardAdminByExpense[expenseId]}
                      onClick={() => onStatusUpdate("expense", expenseId, "forwarded", { adminApprover: forwardAdminByExpense[expenseId] })}
                    >
                      Forward to admin
                    </button>
                  </>
                ) : null}
                {canAdminApprove ? (
                  <>
                    <ActionButton variant="danger" className="px-3" onClick={() => onReject(expenseId, "expense")}>Reject</ActionButton>
                    <ActionButton variant="approve" className="px-3" onClick={() => onStatusUpdate("expense", expenseId, "approved")}>Approve</ActionButton>
                  </>
                ) : null}
                {canAccept ? (
                  <ActionButton variant="approve" className="px-3" onClick={() => onStatusUpdate("expense", expenseId, "accepted")}>Accept</ActionButton>
                ) : null}
              </div>
            </div>
          );
        })}
        {expenses.length === 0 ? <p className="py-4 text-sm text-slate-500">No expense requests yet.</p> : null}
      </div>
    </Card>
  );
}
