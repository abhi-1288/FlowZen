import { ActionButton } from "../../shared";

const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-black/40";
const modalClass = "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl";

export function DeleteSalaryModal({
  deleteSalaryId,
  deleteSalaryEmployee,
  onCancel,
  onConfirm,
}: {
  deleteSalaryId: string | null;
  deleteSalaryEmployee: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!deleteSalaryId) return null;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <h4 className="text-lg font-semibold">Delete salary record?</h4>
        <p className="mt-2 text-sm text-slate-600">
          This will permanently delete the salary record for <strong>{deleteSalaryEmployee}</strong>. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onCancel}>Cancel</ActionButton>
          <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
