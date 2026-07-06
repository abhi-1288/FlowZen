import { Pen } from "lucide-react";
import { AnyRecord } from "../../shared";

export function DayDetailsModal({
  date,
  onClose,
  history,
  requests,
  holidays,
  wfhRequests = [],
  companyWfhDates = [],
  minWorkHours = 8,
}: {
  date: Date;
  onClose: () => void;
  history: AnyRecord[];
  requests: AnyRecord[];
  holidays: AnyRecord[];
  wfhRequests?: AnyRecord[];
  companyWfhDates?: { date: string; reason: string }[];
  minWorkHours?: number;
}) {
  const attendance = history.find((h: any) => {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === date.getTime();
  });

  const leave = requests.find((r: any) => {
    const start = new Date(String(r.startDate));
    const end = new Date(String(r.endDate));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const holiday = holidays.find((h: any) => {
    const start = new Date(String(h.startDate));
    const end = new Date(String(h.endDate));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const approvedWfh = wfhRequests.find((r: any) => {
    if (r.status !== "approved") return false;
    const start = new Date(String(r.startDate));
    const end = new Date(String(r.endDate));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const companyWfh = companyWfhDates.find((d) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === date.getTime();
  });

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{date.toLocaleDateString()}</h3>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
            Close
          </button>
        </div>

        <div className="space-y-4">
          {approvedWfh && (
            <div className="rounded-xl border border-[var(--color-primary-bg)] bg-[var(--color-primary-bg)]/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--color-primary-dark)] flex items-center gap-1.5">
                  <Pen className="h-4 w-4 text-[var(--color-primary)]" /> Work From Home (Approved)
                </p>
                <span className="rounded-full bg-[var(--color-primary-bg)] px-2 py-0.5 text-xs font-bold text-[var(--color-primary-dark)]">
                  Approved
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {String((approvedWfh as any).reason ?? "")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Duration: {String((approvedWfh as any).duration ?? "")} day(s)
              </p>
            </div>
          )}

          {!approvedWfh && companyWfh && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-teal-800 flex items-center gap-1.5">
                  <Pen className="h-4 w-4 text-teal-600" /> Company WFH Day
                </p>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700">
                  Company
                </span>
              </div>
              {companyWfh.reason && (
                <p className="mt-1 text-sm text-slate-700">{companyWfh.reason}</p>
              )}
            </div>
          )}

          {attendance ? (
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex justify-between">
                <p className="text-sm font-bold text-slate-900">Check-in</p>
                <p className="text-sm text-slate-600">
                  {new Date(String(attendance.checkIn)).toLocaleTimeString()}
                </p>
              </div>
              <br />
              <hr />
              <br />
              <div className="flex justify-between">
                <p className="text-sm font-bold text-slate-900">Check-out</p>
                <p className="text-sm text-slate-600">
                  {attendance.checkOut ? new Date(String(attendance.checkOut)).toLocaleTimeString() : "--"}
                </p>
              </div>
              {Boolean(attendance.checkOut) && (() => {
                const diff = new Date(String(attendance.checkOut)).getTime() - new Date(String(attendance.checkIn)).getTime();
                const mins = Math.round(diff / 60000);
                const display = mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1).replace(/\.0$/, '')} hrs`;
                const hrs = diff / 3600000;
                const threshold = minWorkHours / 2;
                const statusInfo = hrs < threshold
                  ? { label: 'Absent', className: 'text-rose-600 bg-rose-50 border border-rose-200' }
                  : hrs < minWorkHours
                    ? { label: 'Half-Day', className: 'text-amber-600 bg-amber-50 border border-amber-200' }
                    : { label: 'Present', className: 'text-emerald-600 bg-emerald-50 border border-emerald-200' };
                return (
                  <>
                    <br />
                    <hr />
                    <br />
                    <div className="flex justify-between">
                      <p className="text-sm font-bold text-slate-900">Hours</p>
                      <p className="text-sm font-semibold text-emerald-600">{display}</p>
                    </div>
                    <br />
                    <hr />
                    <br />
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold text-slate-900">Status</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusInfo.className}`}>{statusInfo.label}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-sm font-bold text-slate-900">No attendance recorded</p>
            </div>
          )}

          {leave && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-emerald-800">Leave</p>
                {Boolean((leave as any).halfDay) && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                    Half-day
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {String((leave as any).reason ?? "")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Duration: {String((leave as any).duration ?? "")} day(s) \u2022
                Status: {String((leave as any).status ?? "")}
              </p>
            </div>
          )}
          {holiday && (
            <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-fuchsia-800">Holiday</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {String((holiday as any).title ?? "Company holiday")}
                  </p>
                </div>
                <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-xs font-bold text-fuchsia-700">
                  Holiday
                </span>
              </div>
              {((holiday as any).description ?? "") && (
                <p className="mt-3 text-sm text-slate-700">
                  {String((holiday as any).description)}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Duration: {String((holiday as any).duration ?? "")} day(s)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
