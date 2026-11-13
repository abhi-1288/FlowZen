export type CompanyCalendarEventType =
  | "birthday"
  | "joining"
  | "anniversary"
  | "leaving"
  | "holiday"
  | "weekend"
  | "leave"
  | "wfh"
  | "meeting"
  | "payroll";

export type CompanyCalendarEvent = {
  date: string; // YYYY-MM-DD
  type: CompanyCalendarEventType;
  title: string;
  region?: string;
  personId?: string;
  id?: string;
};

export type CalendarMember = {
  id: string;
  name: string;
  region?: string | null;
  dob?: Date | string | null;
  companyJoined?: Date | string | null;
  employmentEndDate?: Date | string | null;
  createdAt?: Date | string | null;
  membershipHistory?: { action?: string | null; at?: Date | string | null; company?: unknown }[] | null;
};

export type CompanyCalendarInput = {
  members: CalendarMember[];
  holidays?: { title?: string | null; startDate?: Date | string | null; endDate?: Date | string | null; region?: string | null }[];
  weekends?: { date?: Date | string | null; reason?: string | null; kind?: string | null; region?: string | null }[];
  weekendExclusions?: { date?: Date | string | null; region?: string | null }[];
  leaves?: { requester?: string | null; startDate?: Date | string | null; endDate?: Date | string | null; reason?: string | null }[];
  wfhs?: { requester?: string | null; startDate?: Date | string | null; endDate?: Date | string | null; reason?: string | null }[];
  meetings?: { title?: string | null; date?: Date | string | null; creator?: { name?: string | null } | null }[];
  payrollDay?: number | null;
  year: number;
  monthIndex: number; // 0-based
};

const pad = (n: number) => String(n).padStart(2, "0");

export function dateKey(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sameDayMonthYear(date: Date, monthIndex: number, year: number) {
  return date.getMonth() === monthIndex && date.getFullYear() === year;
}

function regionOf(m: CalendarMember) {
  return String(m.region ?? "").trim();
}

function birthdayForYear(dob: Date | string, year: number): Date | null {
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(year, d.getMonth(), d.getDate());
}

export function eventsForMonth(input: CompanyCalendarInput): CompanyCalendarEvent[] {
  const { year, monthIndex } = input;
  const events: CompanyCalendarEvent[] = [];

  for (const m of input.members ?? []) {
    const region = regionOf(m);

    // Birthday
    if (m.dob) {
      const bday = birthdayForYear(m.dob, year);
      if (bday && bday.getMonth() === monthIndex) {
        events.push({
          date: dateKey(bday),
          type: "birthday",
          title: `Birthday: ${m.name}`,
          region,
          personId: m.id,
        });
      }
    }

    // Joining / anniversary
    const joined = m.companyJoined ? new Date(m.companyJoined) : null;
    if (joined && !Number.isNaN(joined.getTime())) {
      const joinedYear = joined.getFullYear();
      if (joined.getMonth() === monthIndex) {
        if (joinedYear === year) {
          events.push({
            date: dateKey(new Date(year, joined.getMonth(), joined.getDate())),
            type: "joining",
            title: `Joined: ${m.name}`,
            region,
            personId: m.id,
          });
        } else if (joinedYear < year) {
          const years = year - joinedYear;
          events.push({
            date: dateKey(new Date(year, joined.getMonth(), joined.getDate())),
            type: "anniversary",
            title: `${years}-year work anniversary: ${m.name}`,
            region,
            personId: m.id,
          });
        }
      }
    }

    // Leaving (current member's last working day)
    if (m.employmentEndDate) {
      const end = new Date(m.employmentEndDate);
      if (!Number.isNaN(end.getTime()) && sameDayMonthYear(end, monthIndex, year)) {
        events.push({
          date: dateKey(end),
          type: "leaving",
          title: `Leaving: ${m.name}`,
          region,
          personId: m.id,
        });
      }
    }

    // Historical departures
    for (const h of m.membershipHistory ?? []) {
      const action = String(h?.action ?? "");
      if (!["left-company", "removed-company", "contract-expired"].includes(action)) continue;
      const at = h?.at ? new Date(h.at) : null;
      if (!at || Number.isNaN(at.getTime())) continue;
      if (!sameDayMonthYear(at, monthIndex, year)) continue;
      // Dedupe against an employmentEndDate on the same day.
      const duplicate = events.some(
        (e) =>
          e.type === "leaving" &&
          e.personId === m.id &&
          e.date === dateKey(at),
      );
      if (duplicate) continue;
      events.push({
        date: dateKey(at),
        type: "leaving",
        title: `Left company: ${m.name}`,
        region,
        personId: m.id,
      });
    }
  }

  // Holidays
  for (const h of input.holidays ?? []) {
    const start = h.startDate ? new Date(h.startDate) : null;
    const end = h.endDate ? new Date(h.endDate) : start;
    if (!start || Number.isNaN(start.getTime())) continue;
    const last = end && !Number.isNaN(end.getTime()) ? end : start;
    const cursor = new Date(start);
    while (cursor.getTime() <= (last as Date).getTime()) {
      if (cursor.getMonth() === monthIndex && cursor.getFullYear() === year) {
        events.push({
          date: dateKey(cursor),
          type: "holiday",
          title: String(h.title ?? "Holiday"),
          region: String(h.region ?? "").trim(),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Weekends (company + default Sundays)
  for (const w of input.weekends ?? []) {
    const d = w.date ? new Date(w.date) : null;
    if (!d || Number.isNaN(d.getTime())) continue;
    if (d.getMonth() !== monthIndex || d.getFullYear() !== year) continue;
    events.push({
      date: dateKey(d),
      type: "weekend",
      title: w.reason ? String(w.reason) : "Weekend",
      region: String(w.region ?? "").trim(),
    });
  }

  // Leave (viewer's own approved only — caller filters)
  for (const l of input.leaves ?? []) {
    const start = l.startDate ? new Date(l.startDate) : null;
    const end = l.endDate ? new Date(l.endDate) : start;
    if (!start || Number.isNaN(start.getTime())) continue;
    const last = end && !Number.isNaN(end.getTime()) ? end : start;
    const cursor = new Date(start);
    while (cursor.getTime() <= (last as Date).getTime()) {
      if (cursor.getMonth() === monthIndex && cursor.getFullYear() === year) {
        events.push({
          date: dateKey(cursor),
          type: "leave",
          title: l.reason ? `Leave: ${l.reason}` : "Leave",
          region: "",
          personId: String(l.requester ?? ""),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // WFH
  for (const w of input.wfhs ?? []) {
    const start = w.startDate ? new Date(w.startDate) : null;
    const end = w.endDate ? new Date(w.endDate) : start;
    if (!start || Number.isNaN(start.getTime())) continue;
    const last = end && !Number.isNaN(end.getTime()) ? end : start;
    const cursor = new Date(start);
    while (cursor.getTime() <= (last as Date).getTime()) {
      if (cursor.getMonth() === monthIndex && cursor.getFullYear() === year) {
        events.push({
          date: dateKey(cursor),
          type: "wfh",
          title: w.reason ? `WFH: ${w.reason}` : "WFH",
          region: "",
          personId: String(w.requester ?? ""),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Meetings
  for (const m of input.meetings ?? []) {
    const d = m.date ? new Date(m.date) : null;
    if (!d || Number.isNaN(d.getTime())) continue;
    if (d.getMonth() !== monthIndex || d.getFullYear() !== year) continue;
    events.push({
      date: dateKey(d),
      type: "meeting",
      title: `Meeting: ${m.title ?? ""}`,
      region: "",
    });
  }

  // Payroll
  if (input.payrollDay) {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const day = Math.min(input.payrollDay, lastDay);
    events.push({
      date: `${year}-${pad(monthIndex + 1)}-${pad(day)}`,
      type: "payroll",
      title: "Payroll Date",
      region: "",
    });
  }

  // Dedupe
  const seen = new Set<string>();
  const deduped: CompanyCalendarEvent[] = [];
  for (const e of events) {
    const key = `${e.date}|${e.type}|${e.title}|${e.personId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  return deduped;
}

export function regionLabelForEvent(e: CompanyCalendarEvent) {
  return (e.region ?? "").trim();
}
