export function SalaryReminder({
  actorRole,
  onView,
}: {
  actorRole: string;
  onView: () => void;
}) {
  const today = new Date().getDate();

  if (today >= 20 && today <= 21) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div>
          <p className="text-sm font-medium text-amber-800">Salary Reminder</p>
          <p className="mt-1 text-xs text-amber-700">
            Generate salaries by the 28th of this month to ensure timely processing.
          </p>
        </div>
        {actorRole === "finance" ? (
          <button
            className="shrink-0 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900"
            onClick={onView}
          >
            View
          </button>
        ) : null}
      </div>
    );
  }

  if (today >= 22 && today <= 27) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 p-4">
        <div>
          <p className="text-sm font-medium text-sky-800">Salary Reminder</p>
          <p className="mt-1 text-xs text-sky-700">
            Don&apos;t forget to generate salaries before the 28th.
          </p>
        </div>
        {actorRole === "finance" ? (
          <button
            className="shrink-0 rounded-lg bg-sky-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-900"
            onClick={onView}
          >
            View
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
