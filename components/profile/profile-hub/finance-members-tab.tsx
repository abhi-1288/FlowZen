import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord, formatRoleWithCustom } from "./shared";

type MemberAttendance = {
  member: { id: string; name: string; email: string; role: string; baseSalary?: number };
  month: string;
  salary: { netSalary: number; baseSalary: number } | null;
  calendar: {
    day: number;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    leave: boolean;
    leaveReason: string;
    leaveStatus?: string;
    absent: boolean;
    holiday: boolean;
    holidayTitle?: string;
    notJoined?: boolean;
  }[];
};

export function FinanceMembersView({
  members,
  showToast,
}: {
  members: AnyRecord[];
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [membersState, setMembersState] = useState<AnyRecord[]>(members);

  useEffect(() => {
    setMembersState(members);
  }, [members]);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [attendanceMonth, setAttendanceMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [data, setData] = useState<MemberAttendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [dayModal, setDayModal] =
    useState<MemberAttendance["calendar"][0] | null>(null);

  const [modalType, setModalType] = useState<
    "attendance" | "salary" | null
  >(null);

  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [newSalary, setNewSalary] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);

  async function selectMember(
    memberId: string,
    type: "attendance" | "salary",
    monthOverride?: string
  ) {
    setSelectedMemberId(memberId);
    setModalType(type);
    setLoading(true);

    const m = monthOverride ?? attendanceMonth;

    try {
      const res = await apiFetch<MemberAttendance>(
        `/api/finance/member-attendance/${memberId}?month=${m}`
      );

      setData(res);
    } catch {
      showToast("Failed to load data.", "error");
    }

    setLoading(false);
  }

  async function handleUpdateSalary() {
    if (!data || !selectedMemberId) return;

    const amount = Number(newSalary);

    if (isNaN(amount) || amount < 0) {
      showToast("Please enter a valid salary amount", "error");
      return;
    }

    setSavingSalary(true);

    try {
      const res = await fetch(
        `/api/finance/member-salary/${selectedMemberId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            baseSalary: amount,
          }),
        }
      );

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(
          resData.error || "Failed to update salary"
        );
      }

      // update members list instantly
      setMembersState((prev) =>
        prev.map((m) =>
          String(m.id) === String(selectedMemberId)
            ? {
              ...m,
              baseSalary: amount,
            }
            : m
        )
      );

      // update modal instantly
      setData((prev) =>
        prev
          ? {
            ...prev,
            member: {
              ...prev.member,
              baseSalary: amount,
            },
          }
          : prev
      );

      showToast("Salary updated successfully.", "success");

      setIsEditingSalary(false);
    } catch (e: any) {
      showToast(e.message, "error");
    }

    setSavingSalary(false);
  }

  function changeMonth(delta: number) {
    if (!data) return;

    const [y, m] = attendanceMonth.split("-").map(Number);

    const date = new Date(
      Date.UTC(y, m - 1 + delta, 1)
    );

    const nm = date.toISOString().slice(0, 7);

    setAttendanceMonth(nm);

    selectMember(selectedMemberId!, "attendance", nm);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-semibold">Members</h3>
      <p className="mt-1 text-sm text-slate-500">View employee attendance, check-ins, leaves, holidays, and salary.</p>

      <ul className="mt-6 space-y-4">
        {membersState.map((member) => {
          const memberId = String(member.id);
          const teams = Array.isArray(member.teams) ? member.teams.map(String) : [];
          const joinDate = member.companyJoined || member.createdAt;
          const joinDateStr = joinDate ? new Date(String(joinDate)).toLocaleDateString() : "Unknown";
          const currentSalary = Number(member.baseSalary ?? 0);
          const hasBaseSalary = currentSalary > 0;

          console.log(currentSalary, hasBaseSalary);


          return (
            <li key={memberId} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm hover:shadow-md transition">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate text-lg">{String(member.name)}</p>
                <p className="text-sm text-slate-500 truncate">{String(member.email)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                    Role: {formatRoleWithCustom(String(member.role), member.customRole)}
                  </span>
                  <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                    Team: {teams.length ? teams.join(", ") : "No Team"}
                  </span>
                  <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                    Joined: {joinDateStr}
                  </span>

                  {hasBaseSalary ? (
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                      Salary: ₹{Number(currentSalary ?? 0).toLocaleString("en-IN")}
                    </span>
                  ) : (
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                      Salary not assigned
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 w-full sm:w-auto">
                <button
                  className="flex-1 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  onClick={() => selectMember(memberId, "attendance")}
                >
                  See Attendance
                </button>
                <button
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => selectMember(memberId, "salary")}
                >
                  {hasBaseSalary ? "Update Salary" : "Assign Salary"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {membersState.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl mt-4 border border-slate-100">No members found.</p>
      ) : null}

      {/* Main Modal (Attendance or Salary) */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-all" onClick={(e) => { if (e.target === e.currentTarget) { setModalType(null); setSelectedMemberId(null); } }}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="text-2xl font-bold text-slate-900">
                  {modalType === "attendance" ? "Attendance Calendar" : "Salary Details"}
                </h4>
                {data && (
                  <p className="text-sm font-medium text-slate-500 mt-1">
                    {data.member.name} • {data.member.email}
                  </p>
                )}
              </div>
              <button className="text-slate-400 hover:text-slate-800 bg-slate-100 rounded-full p-2" onClick={() => { setModalType(null); setSelectedMemberId(null); }}>
                <X size={20} />
              </button>
            </div>

            {loading ? (
              <p className="py-12 text-center text-slate-500 font-medium">Loading data...</p>
            ) : !data ? (
              <p className="py-12 text-center text-rose-500 font-medium">Failed to load data.</p>
            ) : modalType === "salary" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="font-semibold text-lg text-slate-800">Salary Information</h5>
                  {!isEditingSalary ? (
                    <button
                      onClick={() => { setIsEditingSalary(true); setNewSalary(String(data.member.baseSalary || 0)); }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                    >
                      Edit Base Salary
                    </button>
                  ) : null}
                </div>

                {isEditingSalary ? (
                  <div className="mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-end gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">New Base Salary (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={newSalary}
                        onChange={(e) => setNewSalary(e.target.value)}
                        className="w-full border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="e.g. 50000"
                        disabled={savingSalary}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditingSalary(false)}
                        disabled={savingSalary}
                        className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateSalary}
                        disabled={savingSalary}
                        className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium disabled:opacity-50"
                      >
                        {savingSalary ? "Requesting..." : "Request Update"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current Base Salary</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">₹{(data.member.baseSalary || 0).toLocaleString("en-IN")}</p>
                  </div>
                )}

                <h5 className="font-semibold text-md mb-3 text-slate-800 mt-8">This Month's Salary (Generated)</h5>
                {data.salary ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Base Salary (Month)</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">₹{data.salary.baseSalary.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Net Salary (After deductions)</p>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">₹{data.salary.netSalary.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm bg-white p-4 rounded-lg border border-slate-200">No salary information generated for this month.</p>
                )}
              </div>
            ) : (
              // Attendance Calendar
              <div className="mt-2">
                <div className="mb-6 flex items-center justify-center gap-4">
                  <button onClick={() => changeMonth(-1)} className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                    <div className="bg-slate-50 px-8 py-2.5 text-sm font-bold tracking-widest text-slate-700 uppercase">
                      {new Date(attendanceMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <button onClick={() => changeMonth(1)} className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm">
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="grid grid-cols-7 gap-2 sm:gap-3">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d, i) => (
                      <div key={d} className={`flex flex-col gap-2 rounded-2xl p-2 pb-4 sm:pb-6 transition-all border ${i === 0 ? "bg-rose-50/50 text-rose-600 border-rose-100" : "bg-emerald-50/50 text-emerald-600 border-emerald-100"}`}>
                        <span className="text-center text-[10px] font-black uppercase tracking-tighter sm:text-xs">{d}</span>
                        <div className="space-y-2">
                          {(() => {
                            const year = Number(attendanceMonth.slice(0, 4));
                            const monthIndex = Number(attendanceMonth.slice(5, 7)) - 1;
                            const firstDay = new Date(year, monthIndex, 1).getDay();
                            const cells: React.ReactNode[] = [];
                            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                            const days: (number | null)[] = [];
                            for (let j = 0; j < firstDay; j++) days.push(null);
                            for (let j = 1; j <= daysInMonth; j++) days.push(j);
                            const numWeeks = Math.ceil(days.length / 7);

                            for (let rowIndex = 0; rowIndex < numWeeks; rowIndex++) {
                              const dayIndex = rowIndex * 7 + i;
                              const dayNum = days[dayIndex];
                              if (dayNum === undefined) continue;

                              if (dayNum === null) {
                                cells.push(<div key={`empty-${rowIndex}`} className="h-10 sm:h-14 w-full" />);
                                continue;
                              }

                              const dayData = data.calendar.find(c => c.day === dayNum);
                              if (!dayData) {
                                cells.push(<div key={`empty-${rowIndex}`} className="h-10 sm:h-14 w-full" />);
                                continue;
                              }

                              const now = new Date();
                              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                              const today = todayStr === dayData.date;

                              cells.push(
                                <button
                                  key={dayNum}
                                  type="button"
                                  onClick={() => setDayModal(dayData)}
                                  className={`relative w-full grid place-items-center h-10 sm:h-14 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm ${dayData.notJoined
                                    ? "bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200"
                                    : dayData.holiday
                                      ? "bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200"
                                      : today
                                        ? dayData.checkIn
                                          ? "bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200"
                                          : "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 ring-2 ring-rose-400"
                                        : dayData.checkIn
                                          ? "bg-emerald-100 text-emerald-900 border border-emerald-200 hover:bg-emerald-200"
                                          : dayData.leave
                                            ? "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"
                                            : dayData.absent
                                              ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                                              : i === 0
                                                ? "bg-slate-50 text-slate-400 border border-slate-200"
                                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                    }`}
                                >
                                  <div className="flex flex-col items-center leading-tight">
                                    <span className={today && !dayData.checkIn ? "text-rose-600" : ""}>{dayNum}</span>
                                    {dayData.leave ? <span className="text-[9px] font-medium mt-0.5">Leave</span> : null}
                                    {dayData.absent ? <span className="text-[9px] font-medium mt-0.5">Absent</span> : null}
                                  </div>
                                </button>
                              );
                            }
                            return cells;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs font-semibold text-slate-600 bg-slate-50 py-3 px-6 rounded-full w-fit mx-auto border border-slate-200">
                  <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-emerald-100 border border-emerald-300"></span> Present</div>
                  <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-amber-100 border border-amber-300"></span> Leave</div>
                  <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-rose-50 border border-rose-300"></span> Absent</div>
                  <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-purple-100 border border-purple-300"></span> Holiday</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Day detail modal */}
      {dayModal && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setDayModal(null); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-xl font-bold text-slate-900">{new Date(dayModal.date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h4>
              <button className="text-slate-400 hover:text-slate-800 bg-slate-100 rounded-full p-1.5" onClick={() => setDayModal(null)}><X size={20} /></button>
            </div>
            <div className="space-y-3 text-sm">
              {dayModal.checkIn ? (
                <div className="flex justify-between items-center rounded-xl bg-emerald-50 px-4 py-3 border border-emerald-100">
                  <span className="font-semibold text-emerald-800">Check-in</span>
                  <span className="font-medium text-emerald-900">{dayModal.checkIn}</span>
                </div>
              ) : null}
              {dayModal.checkOut ? (
                <div className="flex justify-between items-center rounded-xl bg-emerald-50 px-4 py-3 border border-emerald-100">
                  <span className="font-semibold text-emerald-800">Check-out</span>
                  <span className="font-medium text-emerald-900">{dayModal.checkOut}</span>
                </div>
              ) : null}
              {!dayModal.checkIn && !dayModal.checkOut && !dayModal.leave && !dayModal.holiday && !dayModal.absent && !dayModal.notJoined ? (
                <div className="flex justify-between items-center rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
                  <span className="font-semibold text-slate-600">Status</span>
                  <span className="font-medium text-slate-500">Weekend / No record</span>
                </div>
              ) : null}
              {dayModal.notJoined ? (
                <div className="flex justify-between items-center rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
                  <span className="font-semibold text-slate-600">Status</span>
                  <span className="font-medium text-slate-500">Didn't join on that day</span>
                </div>
              ) : null}
              {dayModal.absent ? (
                <div className="flex justify-between items-center rounded-xl bg-rose-50 px-4 py-3 border border-rose-100">
                  <span className="font-semibold text-rose-800">Status</span>
                  <span className="text-rose-600 font-bold tracking-wide uppercase">Absent</span>
                </div>
              ) : null}
              {dayModal.leave ? (
                <div className={`rounded-xl px-4 py-3 border ${dayModal.leaveStatus === "approved" ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-semibold ${dayModal.leaveStatus === "approved" ? "text-amber-800" : "text-blue-800"}`}>
                      {dayModal.leaveStatus === "approved" ? "Leave" : "Leave (Pending)"}
                    </span>
                    <span className={`capitalize font-bold ${dayModal.leaveStatus === "approved" ? "text-amber-600" : "text-blue-600"}`}>{dayModal.leaveStatus}</span>
                  </div>
                  <div className="mt-2 bg-white/50 p-2 rounded-lg">
                    <p className="text-sm text-slate-700"><span className="font-semibold">Reason: </span>{dayModal.leaveReason || "No reason provided"}</p>
                  </div>
                </div>
              ) : null}
              {dayModal.holiday ? (
                <div className="rounded-xl bg-purple-50 px-4 py-3 border border-purple-100">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-purple-800">Holiday</span>
                    <span className="text-purple-700 font-bold">{dayModal.holidayTitle}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
