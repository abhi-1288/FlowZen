import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord, formatRoleWithCustom } from "./shared";

type MemberAttendance = {
  member: { id: string; name: string; email: string; role: string };
  month: string;
  salary: { netSalary: number; baseSalary: number } | null;
  calendar: {
    day: number;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    leave: boolean;
    leaveReason: string;
    leaveStatus: string;
    absent: boolean;
    holiday: boolean;
    holidayTitle: string;
  }[];
};

export function FinanceMembersView({
  members,
  showToast,
}: {
  members: AnyRecord[];
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<MemberAttendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [dayModal, setDayModal] = useState<MemberAttendance["calendar"][0] | null>(null);

  async function selectMember(memberId: string, monthOverride?: string) {
    setSelectedMemberId(memberId);
    setLoading(true);
    setData(null);
    const m = monthOverride ?? attendanceMonth;
    try {
      const res = await apiFetch<MemberAttendance>(`/api/finance/member-attendance/${memberId}?month=${m}`);
      setData(res);
    } catch {
      showToast("Failed to load attendance.", "error");
    }
    setLoading(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-semibold">Members</h3>
      <p className="mt-1 text-sm text-slate-500">View employee check-in, check-out, leaves, and holidays.</p>

      <div className="mt-4 flex gap-4">
        <div className="w-56 shrink-0 space-y-1 overflow-y-auto max-h-[70vh]">
          {members.map((member) => {
            const memberId = String(member.id);
            const isSelected = selectedMemberId === memberId;
            return (
              <button
                key={memberId}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${isSelected ? "bg-slate-100 font-medium" : "hover:bg-slate-50"}`}
                onClick={() => selectMember(memberId)}
              >
                <span className="truncate block">{String(member.name)}</span>
                <span className="text-xs text-slate-400 truncate block">{formatRoleWithCustom(String(member.role), member.customRole)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0">
          {!selectedMemberId ? (
            <p className="py-8 text-center text-sm text-slate-400">Select a member to view their attendance.</p>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading...</p>
          ) : data ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium">{data.member.name}</p>
                  <p className="text-xs text-slate-500">{data.member.email} • {data.member.role}
                    {data.salary ? <> • ₹{data.salary.netSalary.toLocaleString("en-IN")}/mo</> : null}
                  </p>
                </div>
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  type="month"
                  value={attendanceMonth}
                  onChange={(e) => { const nm = e.target.value; setAttendanceMonth(nm); selectMember(selectedMemberId, nm); }}
                />
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-1 font-medium text-slate-500">{d}</div>
                ))}
                {(() => {
                  const firstDay = new Date(attendanceMonth + "-01").getDay();
                  const blanks = Array.from({ length: firstDay });
                  const cells: React.ReactNode[] = blanks.map((_, i) => <div key={`b${i}`} />);
                  data.calendar.forEach((day) => {
                    const dayDate = new Date(day.date);
                    const isSunday = dayDate.getDay() === 0;
                    const today = new Date().toISOString().slice(0, 10) === day.date;
                    cells.push(
                      <button
                        key={day.day}
                        type="button"
                        className={`rounded p-1.5 text-center transition-colors ${today ? "ring-2 ring-blue-400" : ""} ${
                          day.leave
                            ? "bg-amber-100 text-amber-800"
                            : day.absent
                              ? "bg-rose-50 text-rose-500"
                              : day.holiday
                                ? "bg-purple-100 text-purple-700"
                                : day.checkIn
                                  ? "bg-emerald-50 text-emerald-700"
                                  : isSunday
                                    ? "bg-slate-50 text-slate-300"
                                    : "text-slate-400"
                        }`}
                        onClick={() => setDayModal(day)}
                      >
                        <p className="font-medium">{day.day}</p>
                        {day.leave ? <p className="text-[10px] leading-tight">{day.leaveStatus === "pending" || day.leaveStatus === "manager-approved" ? "Pending" : "Leave"}</p> : null}
                        {day.absent ? <p className="text-[10px] leading-tight">Absent</p> : null}
                        {day.holiday ? <p className="text-[10px] leading-tight">{day.holidayTitle.slice(0, 6)}</p> : null}
                        {day.checkIn ? <p className="text-[10px] leading-tight truncate">{day.checkIn}{day.checkOut ? `-${day.checkOut}` : ""}</p> : null}
                        {!day.leave && !day.absent && !day.checkIn && !day.holiday && !isSunday ? <p className="text-[10px] leading-tight">—</p> : null}
                      </button>
                    );
                  });
                  return cells;
                })()}
              </div>

              <div className="mt-3 flex gap-4 text-xs text-slate-500 flex-wrap">
                <span><span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-200 align-middle mr-1" /> Present</span>
                <span><span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-200 align-middle mr-1" /> Leave</span>
                <span><span className="inline-block w-3 h-3 rounded bg-rose-50 border border-rose-200 align-middle mr-1" /> Absent</span>
                <span><span className="inline-block w-3 h-3 rounded bg-purple-100 border border-purple-200 align-middle mr-1" /> Holiday</span>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Failed to load attendance data.</p>
          )}
        </div>
      </div>

      {/* Day detail modal */}
      {dayModal ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDayModal(null); }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">{new Date(dayModal.date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h4>
              <button className="text-slate-500 hover:text-slate-800" onClick={() => setDayModal(null)}>✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {dayModal.checkIn ? (
                <div className="flex justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="font-medium text-emerald-700">Check-in</span>
                  <span>{dayModal.checkIn}</span>
                </div>
              ) : null}
              {dayModal.checkOut ? (
                <div className="flex justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="font-medium text-emerald-700">Check-out</span>
                  <span>{dayModal.checkOut}</span>
                </div>
              ) : null}
              {!dayModal.checkIn && !dayModal.checkOut && !dayModal.leave && !dayModal.holiday && !dayModal.absent ? (
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-500">Status</span>
                  <span className="text-slate-400">Weekend / No record</span>
                </div>
              ) : null}
              {dayModal.absent ? (
                <div className="flex justify-between rounded-lg bg-rose-50 px-3 py-2">
                  <span className="font-medium text-rose-700">Status</span>
                  <span className="text-rose-600">Absent</span>
                </div>
              ) : null}
              {dayModal.leave ? (
                <div className={`rounded-lg px-3 py-2 ${dayModal.leaveStatus === "approved" ? "bg-amber-50" : "bg-blue-50"}`}>
                  <div className="flex justify-between">
                    <span className={`font-medium ${dayModal.leaveStatus === "approved" ? "text-amber-700" : "text-blue-700"}`}>
                      {dayModal.leaveStatus === "approved" ? "Leave" : "Leave (Pending)"}
                    </span>
                    <span className={`capitalize ${dayModal.leaveStatus === "approved" ? "text-amber-600" : "text-blue-600"}`}>{dayModal.leaveStatus}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{dayModal.leaveReason || "No reason provided"}</p>
                </div>
              ) : null}
              {dayModal.holiday ? (
                <div className="rounded-lg bg-purple-50 px-3 py-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-purple-700">Holiday</span>
                    <span className="text-purple-600">{dayModal.holidayTitle}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
