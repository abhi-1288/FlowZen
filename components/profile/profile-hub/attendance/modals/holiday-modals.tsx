import { FormEvent, useState } from "react";
import { ActionButton, AnyRecord } from "../../shared";

export function HolidayModal({
  onClose,
  onRefresh,
  showToast,
}: {
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/attendance/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      onRefresh();
      showToast("Holiday added successfully!");
      onClose();
    } catch {
      showToast("Failed to add holiday", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Add Holiday</h3>
        <p className="mt-1 text-sm text-slate-500">
          Create a future holiday for the organization.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Holiday Title
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Holiday name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional holiday note"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="rounded-full bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Holiday"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditHolidayModal({
  holiday,
  onClose,
  onSave,
  onDelete,
  showToast,
}: {
  holiday: AnyRecord;
  onClose: () => void;
  onSave: (updates: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    title: String(holiday.title ?? ""),
    description: String(holiday.description ?? ""),
    startDate: holiday.startDate
      ? new Date(String(holiday.startDate)).toISOString().slice(0, 10)
      : "",
    endDate: holiday.endDate
      ? new Date(String(holiday.endDate)).toISOString().slice(0, 10)
      : "",
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch {
      showToast("Failed to update holiday", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } catch {
      showToast("Failed to delete holiday", "error");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 relative">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Edit Holiday</h3>
            <p className="mt-1 text-sm text-slate-500">
              Update holiday details or remove it entirely.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Holiday Title
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Holiday name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional holiday note"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
            >
              Delete
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                type="submit"
                className="rounded-full bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Confirm Delete</h3>
            <p className="mt-2 text-sm text-slate-500">
              Delete holiday "{String(holiday.title ?? "")}"? This action cannot
              be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminLeaveHistoryModal({
  requests,
  holidays,
  onClose,
  onEditHoliday,
  onDeleteHoliday,
  onAddHoliday,
}: {
  requests: AnyRecord[];
  holidays: AnyRecord[];
  onClose: () => void;
  onEditHoliday: (holiday: AnyRecord) => void;
  onDeleteHoliday: (holiday: AnyRecord) => void;
  onAddHoliday: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Manage Holidays
            </h3>
            <p className="text-sm text-slate-500">
              Create, update, or remove company holidays from one place.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAddHoliday}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
            >
              Add Holiday
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-3 py-2 border text-left">Title</th>
                  <th className="px-3 py-2 border text-left">From</th>
                  <th className="px-3 py-2 border text-left">To</th>
                  <th className="px-3 py-2 border text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-sm text-slate-500"
                    >
                      No holidays available.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h: any) => (
                    <tr
                      key={h._id}
                      className="border-b bg-white hover:bg-slate-50 transition"
                    >
                      <td className="px-3 py-3 border">{h.title}</td>
                      <td className="px-3 py-3 border">
                        {h.startDate
                          ? new Date(h.startDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-3 py-3 border">
                        {h.endDate
                          ? new Date(h.endDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-3 py-3 border">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => onEditHoliday(h)}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteHoliday(h)}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
