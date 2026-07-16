import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, UtensilsCrossed, Bus, Check, X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord, formatRole, formatRoleWithCustom } from "./shared";
import { HR_MEMBER_ROLE_KEYS } from "./admin-tabs/types";

const FINANCE_ROLE_CATEGORIES = [...HR_MEMBER_ROLE_KEYS, "senior-security", "junior-security"] as const;

type PolicyData = {
  foodAmount: number;
  travelAccommodationAmount: number;
  foodOptedOutMembers: { _id: string; name: string; email: string; role: string }[];
  travelOptedOutMembers: { _id: string; name: string; email: string; role: string }[];
};

type MemberAttendance = {
  member: { id: string; name: string; email: string; role: string; baseSalary?: number };
  month: string;
  salary: { netSalary: number; baseSalary: number } | null;
  calendar: {
    day: number;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    leave: boolean;
    leaveReason: string;
    leaveStatus?: string;
    absent: boolean;
    halfDay?: boolean;
    workHours?: number | null;
    holiday: boolean;
    holidayTitle?: string;
    notJoined?: boolean;
    wfh: boolean;
    wfhReason: string;
    wfhDuration: number;
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

  const [modalRole, setModalRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [policyModal, setPolicyModal] = useState(false);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [foodAmount, setFoodAmount] = useState("");
  const [travelAmount, setTravelAmount] = useState("");

  // Check-out requests
  const [checkOutRequests, setCheckOutRequests] = useState<AnyRecord[]>([]);
  const [checkOutModalRequest, setCheckOutModalRequest] = useState<AnyRecord | null>(null);
  const [checkOutRejectReason, setCheckOutRejectReason] = useState("");
  const [checkOutStatusType, setCheckOutStatusType] = useState<"present" | "halfDay" | "absent">("present");
  const [checkOutStep, setCheckOutStep] = useState<"action" | "reject" | "approve-status">("action");
  const [minWorkHours, setMinWorkHours] = useState(8);

  useEffect(() => {
    apiFetch<{ requests: AnyRecord[]; minWorkHours?: number }>("/api/attendance/checkout-request")
      .then((res) => {
        setCheckOutRequests(res.requests ?? []);
        if (res.minWorkHours) setMinWorkHours(res.minWorkHours);
      })
      .catch(() => { });
  }, []);

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

  async function loadPolicy() {
    try {
      const res = await apiFetch<PolicyData>("/api/finance/policy");
      setPolicyData({
        foodAmount: res.foodAmount,
        travelAccommodationAmount: res.travelAccommodationAmount,
        foodOptedOutMembers: res.foodOptedOutMembers ?? [],
        travelOptedOutMembers: res.travelOptedOutMembers ?? [],
      });
      setFoodAmount(String(res.foodAmount ?? 0));
      setTravelAmount(String(res.travelAccommodationAmount ?? 0));
    } catch {
      showToast("Unable to load policy.", "error");
    }
  }

  async function savePolicy() {
    setPolicySaving(true);
    try {
      const res = await apiFetch<PolicyData>("/api/finance/policy", {
        method: "POST",
        body: JSON.stringify({
          foodAmount: Math.max(0, Number(foodAmount)),
          travelAccommodationAmount: Math.max(0, Number(travelAmount)),
        }),
      });
      setPolicyData(res);
      showToast("Policy saved.", "success");
    } catch {
      showToast("Unable to save policy.", "error");
    } finally {
      setPolicySaving(false);
    }
  }

  async function togglePolicyOptOut(memberId: string, type: "food" | "travel") {
    try {
      const res = await apiFetch<PolicyData & { nowOptedOut: boolean }>("/api/finance/policy", {
        method: "PATCH",
        body: JSON.stringify({ memberId, type }),
      });
      setPolicyData({
        foodAmount: res.foodAmount,
        travelAccommodationAmount: res.travelAccommodationAmount,
        foodOptedOutMembers: res.foodOptedOutMembers ?? [],
        travelOptedOutMembers: res.travelOptedOutMembers ?? [],
      });
      const label = type === "food" ? "Food Allowance" : "Travel Accommodation";
      showToast(res.nowOptedOut ? `Member opted out of ${label}.` : `Member opted in for ${label}.`, "success");
    } catch {
      showToast("Unable to toggle policy opt-out.", "error");
    }
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
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-5 border-l-4 border-amber-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Members</h3>
        <p className="mt-0.5 text-sm text-slate-500">View employee attendance, check-ins, leaves, holidays, and salary.</p>
      </div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <ActionButton
          variant="secondary"
          onClick={() => { void loadPolicy(); setPolicyModal(true); }}
          type="button"
        >
          <UtensilsCrossed size={16} />
          Policies
        </ActionButton>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          className={`rounded-lg border px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${!modalRole ? "border-slate-950 bg-slate-100" : "border-transparent bg-slate-50"}`}
          onClick={() => setModalRole(null)}
        >
          <p className="text-xs font-medium text-slate-500">All</p>
          <p className="text-lg font-semibold">{membersState.length}</p>
        </button>
        {FINANCE_ROLE_CATEGORIES.map((cat) => {
          const count = cat === "senior-security"
            ? membersState.filter((m) => String(m.role) === "security" && Boolean((m as any).isSeniorSecurity)).length
            : cat === "junior-security"
              ? membersState.filter((m) => String(m.role) === "security" && !Boolean((m as any).isSeniorSecurity)).length
              : membersState.filter((m) => String(m.role) === cat).length;
          return (
            <button
              key={cat}
              type="button"
              className={`rounded-lg border px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${modalRole === cat ? "border-slate-950 bg-slate-100" : "border-transparent bg-slate-50"}`}
              onClick={() => { setModalRole(cat); setSearchQuery(""); setSearchInput(""); }}
            >
              <p className="text-xs font-medium text-slate-500">{cat === "senior-security" ? "Senior Security" : cat === "junior-security" ? "Junior Security" : formatRole(cat)}</p>
              <p className="text-lg font-semibold">{count}</p>
            </button>
          );
        })}
      </div>

      {(() => {
        const today = new Date().getDate();
        if (today >= 20 && today <= 21) {
          return (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                Salary Reminder
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Generate salaries by the 28th of this month to ensure timely processing.
              </p>
            </div>
          );
        }
        if (today >= 22 && today <= 27) {
          return (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-medium text-sky-800">
                Salary Reminder
              </p>
              <p className="mt-1 text-xs text-sky-700">
                Don't forget to generate salaries before the 28th.
              </p>
            </div>
          );
        }
        return null;
      })()}

      {!modalRole && membersState.length === 0 && (
        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No approved company members yet.</p>
      )}

      {/* Main Modal (Attendance or Salary) */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-all" onClick={(e) => { if (e.target === e.currentTarget) { setModalType(null); setSelectedMemberId(null); } }}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
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
                      <ActionButton
                        variant="secondary"
                        onClick={() => setIsEditingSalary(false)}
                        disabled={savingSalary}
                      >
                        Cancel
                      </ActionButton>
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
                  <ActionButton onClick={() => changeMonth(-1)} variant="secondary" className="h-10 w-12" aria-label="Previous month">
                    <ChevronLeft size={20} />
                  </ActionButton>
                  <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                    <div className="bg-slate-50 px-8 py-2.5 text-sm font-bold tracking-widest text-slate-700 uppercase">
                      {new Date(attendanceMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <ActionButton onClick={() => changeMonth(1)} variant="secondary" className="h-10 w-12" aria-label="Next month">
                    <ChevronRight size={20} />
                  </ActionButton>
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
                                      : dayData.halfDay
                                        ? "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"
                                        : today
                                          ? dayData.checkIn
                                            ? "bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200"
                                            : "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 ring-2 ring-rose-400"
                                          : dayData.checkIn
                                            ? "bg-emerald-100 text-emerald-900 border border-emerald-200 hover:bg-emerald-200"
                                            : dayData.wfh
                                              ? "bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)] border border-[var(--color-primary-bg)] hover:bg-[var(--color-primary-bg)]"
                                              : dayData.leave
                                                ? "bg-pink-100 text-pink-700 border border-pink-200 hover:bg-pink-200"
                                                : dayData.absent
                                                  ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                                                  : i === 0
                                            ? "bg-slate-50 text-slate-400 border border-slate-200"
                                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                    }`}
                                >
                                  <div className="flex flex-col items-center leading-tight">
                                    <span className={today && !dayData.checkIn ? "text-rose-600" : ""}>{dayNum}</span>
                                    {dayData.halfDay ? <span className="text-[9px] font-medium mt-0.5">Half</span> : null}
                                    {dayData.wfh ? <span className="text-[9px] font-medium mt-0.5">WFH</span> : null}
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
                  <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-amber-100 border border-amber-300"></span> Half-Day</div>
                  <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-[var(--color-primary-bg)] border border-[var(--color-primary-light)]"></span> WFH</div>
                  <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-pink-100 border border-pink-300"></span> Leave</div>
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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
              {dayModal.checkInTime && dayModal.checkOutTime ? (() => {
                const diff = new Date(dayModal.checkOutTime).getTime() - new Date(dayModal.checkInTime).getTime();
                const mins = Math.round(diff / 60000);
                const display = mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1).replace(/\.0$/, '')} hrs`;
                return (
                  <div className="flex justify-between items-center rounded-xl bg-emerald-50 px-4 py-3 border border-emerald-100">
                    <span className="font-semibold text-emerald-800">Hours</span>
                    <span className="font-medium text-emerald-900">{display}</span>
                  </div>
                );
              })() : null}
              {!dayModal.checkIn && !dayModal.checkOut && !dayModal.leave && !dayModal.holiday && !dayModal.absent && !dayModal.halfDay && !dayModal.notJoined && !dayModal.wfh ? (
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
              {dayModal.absent && !dayModal.halfDay ? (
                <div className="flex justify-between items-center rounded-xl bg-rose-50 px-4 py-3 border border-rose-100">
                  <span className="font-semibold text-rose-800">Status</span>
                  <span className="text-rose-600 font-bold tracking-wide uppercase">Absent</span>
                </div>
              ) : null}
              {dayModal.halfDay ? (
                <div className="rounded-xl bg-amber-50 px-4 py-3 border border-amber-100">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-800">Status</span>
                    <span className="text-amber-600 font-bold tracking-wide uppercase">Half-Day</span>
                  </div>
                  {dayModal.workHours != null && (
                    <p className="mt-1 text-xs text-amber-700">Worked: {dayModal.workHours} hrs</p>
                  )}
                </div>
              ) : null}
              {dayModal.leave ? (
                <div className={`rounded-xl px-4 py-3 border ${dayModal.leaveStatus === "approved" ? "bg-amber-50 border-amber-100" : "bg-[var(--color-primary-bg)] border-[var(--color-primary-bg)]"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-semibold ${dayModal.leaveStatus === "approved" ? "text-amber-800" : "text-[var(--color-primary-dark)]"}`}>
                      {dayModal.leaveStatus === "approved" ? "Leave" : "Leave (Pending)"}
                    </span>
                    <span className={`capitalize font-bold ${dayModal.leaveStatus === "approved" ? "text-amber-600" : "text-[var(--color-primary)]"}`}>{dayModal.leaveStatus}</span>
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
              {dayModal.wfh ? (
                <div className="rounded-xl bg-[var(--color-primary-bg)] px-4 py-3 border border-[var(--color-primary-bg)]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-[var(--color-primary-dark)]">Work From Home (Approved)</span>
                    <span className="text-[var(--color-primary)] font-bold">Approved</span>
                  </div>
                  <div className="mt-2 bg-white/50 p-2 rounded-lg">
                    <p className="text-sm text-slate-700"><span className="font-semibold">Reason: </span>{dayModal.wfhReason || "No reason provided"}</p>
                    {dayModal.wfhDuration > 0 && (
                      <p className="text-sm text-slate-700 mt-1"><span className="font-semibold">Duration: </span>{dayModal.wfhDuration} day{dayModal.wfhDuration === 1 ? "" : "s"}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {modalRole ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-all" onClick={(e) => { if (e.target === e.currentTarget) { setModalRole(null); setSearchQuery(""); setSearchInput(""); } }}>
          <div className="max-h-[min(90vh,720px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h4 className="text-xl font-semibold">{modalRole === "senior-security" ? "Senior Security" : modalRole === "junior-security" ? "Junior Security" : formatRole(modalRole)}</h4>
                <p className="text-sm text-slate-500">{(() => {
                  const roleFiltered = modalRole === "senior-security"
                    ? membersState.filter((m) => String(m.role) === "security" && Boolean((m as any).isSeniorSecurity))
                    : modalRole === "junior-security"
                      ? membersState.filter((m) => String(m.role) === "security" && !Boolean((m as any).isSeniorSecurity))
                      : membersState.filter((m) => String(m.role) === modalRole);
                  return `${roleFiltered.length} member${roleFiltered.length === 1 ? "" : "s"}`;
                })()}</p>
              </div>
              <button className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700" type="button" onClick={() => { setModalRole(null); setSearchQuery(""); setSearchInput(""); }}>
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pt-4">
              <div className="flex gap-2">
                <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setSearchQuery(searchInput.trim()); }} placeholder="Search members by name, email, or team..." className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950 focus:ring-0" />
                <ActionButton variant="primary" onClick={() => setSearchQuery(searchInput.trim())}>Search</ActionButton>
              </div>
            </div>
            <div className="max-h-[min(55vh,420px)] overflow-y-auto px-6 py-4">
              {(() => {
                const roleFiltered = modalRole === "senior-security"
                  ? membersState.filter((m) => String(m.role) === "security" && Boolean((m as any).isSeniorSecurity))
                  : modalRole === "junior-security"
                    ? membersState.filter((m) => String(m.role) === "security" && !Boolean((m as any).isSeniorSecurity))
                    : membersState.filter((m) => String(m.role) === modalRole);
                const query = searchQuery.toLowerCase().trim();
                const filtered = query
                  ? roleFiltered.filter((m) => {
                      const name = String(m.name ?? "").toLowerCase();
                      const email = String(m.email ?? "").toLowerCase();
                      const teams = Array.isArray(m.teams) ? m.teams.map(String).join(" ").toLowerCase() : "";
                      const code = String(m.companyIdentityCode ?? "").toLowerCase();
                      const codeNum = code.split("-").pop() ?? "";
                      return name.includes(query) || email.includes(query) || teams.includes(query) || code.includes(query) || codeNum.includes(query);
                    })
                  : roleFiltered;
                if (filtered.length === 0) {
                  return <p className="py-8 text-center text-sm text-slate-500">No members match your search.</p>;
                }
                return (
                  <ul className="space-y-4">
                    {filtered.map((member) => {
                      const memberId = String(member.id);
                      const currentSalary = Number(member.baseSalary ?? 0);
                      const hasBaseSalary = currentSalary > 0;
                      return (
                        <li key={memberId} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm hover:shadow-md transition">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate text-lg">{String(member.name)}</p>
                            <p className="text-sm text-slate-500 truncate">{String(member.email)}</p>
                          </div>
                          <div className="flex shrink-0 gap-2 w-full sm:w-auto">
                            <ActionButton variant="primary" className="flex-1" onClick={() => { setModalRole(null); setSearchQuery(""); setSearchInput(""); selectMember(memberId, "attendance"); }}>
                              See Attendance
                            </ActionButton>
                            <ActionButton variant="secondary" className="flex-1" onClick={() => { setModalRole(null); setSearchQuery(""); setSearchInput(""); selectMember(memberId, "salary"); }}>
                              {hasBaseSalary ? "Update Salary" : "Assign Salary"}
                            </ActionButton>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {policyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setPolicyModal(false); }}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="text-2xl font-bold text-slate-900">Company Policies</h4>
                <p className="text-sm text-slate-500 mt-1">Set fixed deductions and manage member opt-outs.</p>
              </div>
              <button className="text-slate-400 hover:text-slate-800 bg-slate-100 rounded-full p-2" onClick={() => setPolicyModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Food Allowance Deduction (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  value={foodAmount}
                  onChange={(e) => setFoodAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Travel Accommodation Deduction (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  value={travelAmount}
                  onChange={(e) => setTravelAmount(e.target.value)}
                />
              </div>
              <ActionButton
                variant="primary"
                className="w-full"
                disabled={policySaving}
                onClick={() => void savePolicy()}
                type="button"
              >
                {policySaving ? "Saving..." : "Save Policy"}
              </ActionButton>
            </div>

            {policyData ? (
              <div>
                <h5 className="font-semibold text-slate-800 mb-3">Member Policy Status</h5>
                <p className="text-xs text-slate-500 mb-3">Policies apply by default. Toggle each accommodation type separately.</p>
                <div className="space-y-2">
                  {membersState.map((member) => {
                    const memberId = String(member.id);
                    const isFoodOptedOut = policyData.foodOptedOutMembers.some(
                      (om) => String(om._id ?? "") === memberId,
                    );
                    const isTravelOptedOut = policyData.travelOptedOutMembers.some(
                      (om) => String(om._id ?? "") === memberId,
                    );
                    const showFood = policyData.foodAmount > 0;
                    const showTravel = policyData.travelAccommodationAmount > 0;
                    return (
                      <div key={memberId} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{String(member.name)}</p>
                          <p className="text-xs text-slate-500">{String(member.email)}</p>
                        </div>
                        <div className="flex gap-2">
                          {showFood ? (
                            <button
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                isFoodOptedOut
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                              }`}
                              onClick={() => void togglePolicyOptOut(memberId, "food")}
                              type="button"
                            >
                              {isFoodOptedOut ? "Food: Opted Out" : "Food: Active"}
                            </button>
                          ) : null}
                          {showTravel ? (
                            <button
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                isTravelOptedOut
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                              }`}
                              onClick={() => void togglePolicyOptOut(memberId, "travel")}
                              type="button"
                            >
                              {isTravelOptedOut ? "Travel: Opted Out" : "Travel: Active"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Check-Out Request Modal */}
      {checkOutModalRequest ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setCheckOutModalRequest(null); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-900">Check-Out Request</h4>
              <ActionButton variant="ghost" className="p-1" onClick={() => setCheckOutModalRequest(null)} aria-label="Close">
                <X size={20} />
              </ActionButton>
            </div>
            {(() => {
              const req = checkOutModalRequest as any;
              const requester = req.requester as any;
              const att = req.attendance as any;
              return (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-sm font-semibold">{requester?.name ?? "Unknown"}</p>
                    <p className="text-xs text-slate-500">{requester?.email ?? ""}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      Date: {new Date(req.date).toLocaleDateString()} — Check-in at{" "}
                      {att?.checkIn ? new Date(att.checkIn).toLocaleTimeString() : "--"}
                    </p>
                    {req.reason ? (
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-medium">Reason:</span> {req.reason}
                      </p>
                    ) : null}
                  </div>

                  {checkOutStep === "action" && (
                    <div className="flex gap-3">
                      <ActionButton
                        variant="danger"
                        className="flex-1"
                        onClick={() => setCheckOutStep("reject")}
                      >
                        Reject
                      </ActionButton>
                      <ActionButton
                        variant="approve"
                        className="flex-1"
                        onClick={() => setCheckOutStep("approve-status")}
                      >
                        Approve
                      </ActionButton>
                    </div>
                  )}

                  {checkOutStep === "reject" && (
                    <div className="space-y-3">
                      <textarea
                        value={checkOutRejectReason}
                        onChange={(e) => setCheckOutRejectReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <ActionButton
                          variant="secondary"
                          className="flex-1"
                          onClick={() => setCheckOutStep("action")}
                        >
                          Back
                        </ActionButton>
                        <button
                          onClick={async () => {
                            if (!checkOutRejectReason.trim()) return;
                            try {
                              await apiFetch(`/api/attendance/checkout-request/${String(req._id)}`, {
                                method: "PATCH",
                                body: JSON.stringify({ action: "reject", rejectionReason: checkOutRejectReason.trim() }),
                              });
                              showToast("Check-out request rejected.", "success");
                              setCheckOutModalRequest(null);
                              const res = await apiFetch<{ requests: AnyRecord[] }>("/api/attendance/checkout-request");
                              setCheckOutRequests(res.requests ?? []);
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : "Failed to reject request.", "error");
                            }
                          }}
                          disabled={!checkOutRejectReason.trim()}
                          className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Confirm Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {checkOutStep === "approve-status" && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-700">Select attendance status:</p>
                      <select
                        value={checkOutStatusType}
                        onChange={(e) => setCheckOutStatusType(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="present">Present</option>
                        <option value="halfDay">Half-Day</option>
                        <option value="absent">Absent</option>
                      </select>
                      {att?.checkIn ? (() => {
                        const checkInDate = new Date(att.checkIn);
                        const checkInMs = checkInDate.getTime();
                        const mwh = minWorkHours;
                        let hoursToAdd: number;
                        if (checkOutStatusType === "absent") {
                          hoursToAdd = 0;
                        } else if (checkOutStatusType === "halfDay") {
                          hoursToAdd = mwh / 2;
                        } else {
                          hoursToAdd = mwh;
                        }
                        const estimatedDate = new Date(checkInMs + hoursToAdd * 60 * 60 * 1000);
                        const estimatedTime = estimatedDate.toLocaleTimeString();
                        return (
                          <div className="rounded-xl border border-slate-200 bg-[var(--color-primary-bg)] px-4 py-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-[var(--color-primary-dark)]">Estimated Check-out</span>
                              <span className="text-sm font-bold text-[var(--color-primary-dark)]">{estimatedTime}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-[var(--color-primary)]">
                              {checkOutStatusType === "absent"
                                ? "Check-out set to same as check-in (0 hrs)"
                                : checkOutStatusType === "halfDay"
                                  ? `Check-in + ${mwh / 2} hrs (Half-Day)`
                                  : `Check-in + ${mwh} hrs (Full Day)`}
                            </p>
                          </div>
                        );
                      })() : null}
                      <div className="flex gap-2">
                        <ActionButton
                          variant="secondary"
                          className="flex-1"
                          onClick={() => setCheckOutStep("action")}
                        >
                          Back
                        </ActionButton>
                        <ActionButton
                          variant="approve"
                          className="flex-1"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/attendance/checkout-request/${String(req._id)}`, {
                                method: "PATCH",
                                body: JSON.stringify({ action: "approve", statusType: checkOutStatusType }),
                              });
                              const label = checkOutStatusType === "absent" ? "Absent" : checkOutStatusType === "halfDay" ? "Half-Day" : "Present";
                              showToast(`Check-out approved. Status: ${label}`, "success");
                              setCheckOutModalRequest(null);
                              const res = await apiFetch<{ requests: AnyRecord[] }>("/api/attendance/checkout-request");
                              setCheckOutRequests(res.requests ?? []);
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : "Failed to approve.", "error");
                            }
                          }}
                        >
                          Confirm
                        </ActionButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </section>
  );
}


