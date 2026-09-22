import { ATSInterview } from "@/models/ATSInterview";
import { ATSOffer } from "@/models/ATSOffer";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { Holiday } from "@/models/Holiday";
import { ITJoiningCode } from "@/models/ITJoiningCode";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Meeting } from "@/models/Meeting";
import { ProjectBudget } from "@/models/ProjectBudget";
import { User } from "@/models/User";
import { addDays, dayLabel, sameDay, startOfDay, timeLabel } from "./dates";
import type { CommandCenterContext } from "./context";
import type { UpcomingCategory, UpcomingItem, UpcomingSection } from "./types";

interface RawUpcoming {
  date: Date;
  time?: string;
  title: string;
  category: UpcomingCategory;
  href?: string;
}

const WINDOW_DAYS = 14;

export async function buildUpcoming(ctx: CommandCenterContext): Promise<UpcomingSection[]> {
  const { companyId, variant, userId, now } = ctx;
  const windowStart = now;
  const windowEnd = addDays(now, WINDOW_DAYS);
  const raw: RawUpcoming[] = [];

  const showPeople = variant === "admin" || variant === "hr";
  const showPersonal = variant === "personal";
  const showBudgets = variant === "admin" || variant === "projects";
  const showPayroll = variant === "admin" || variant === "finance";
  const showCodes = variant === "admin" || variant === "it";

  const [
    people,
    personalLeaves,
    budgets,
    policy,
    codes,
  ] = await Promise.all([
    showPeople
      ? Promise.all([
          ATSInterview.find({
            company: companyId,
            status: "scheduled",
            scheduledAt: { $gte: windowStart, $lt: windowEnd },
          })
            .populate("candidate", "firstName lastName")
            .populate("job", "title")
            .select("scheduledAt")
            .lean(),
          User.find({ company: companyId, companyStatus: "approved" })
            .select("name dob employmentEndDate")
            .lean(),
          LeaveRequest.find({
            company: companyId,
            status: "approved",
            startDate: { $gte: windowStart, $lt: windowEnd },
          })
            .select("startDate requester")
            .lean(),
          ATSOffer.find({
            company: companyId,
            status: "accepted",
            joiningDate: { $gte: windowStart, $lt: windowEnd },
          })
            .populate("candidate", "firstName lastName")
            .select("joiningDate")
            .lean(),
          Meeting.find({
            company: companyId,
            status: "scheduled",
            date: { $gte: windowStart, $lt: windowEnd },
          })
            .select("title date time")
            .lean(),
          Holiday.find({
            company: companyId,
            startDate: { $gte: windowStart, $lt: windowEnd },
          })
            .select("title startDate")
            .lean(),
        ])
      : Promise.resolve(null),
    showPersonal
      ? LeaveRequest.find({
          requester: userId,
          status: "approved",
          startDate: { $gte: windowStart, $lt: windowEnd },
        })
          .select("startDate")
          .lean()
      : Promise.resolve(null),
    showBudgets
      ? ProjectBudget.find({
          company: companyId,
          status: "approved",
          deadline: { $gte: windowStart, $lt: windowEnd },
        })
          .populate("board", "title")
          .select("deadline board")
          .lean()
      : Promise.resolve(null),
    showPayroll
      ? CompanyPolicy.findOne({ company: companyId })
          .select("salaryCycleDay")
          .lean()
      : Promise.resolve(null),
    showCodes
      ? ITJoiningCode.find({
          company: companyId,
          status: "active",
          expiresAt: { $gte: windowStart, $lt: windowEnd },
        })
          .select("code expiresAt")
          .lean()
      : Promise.resolve(null),
  ]);

  if (people) {
    const [interviews, members, leaves, offers, meetings, holidays] = people;

    for (const iv of interviews) {
      const candidate = iv.candidate as { firstName?: string; lastName?: string } | undefined;
      const job = iv.job as { title?: string } | undefined;
      raw.push({
        date: iv.scheduledAt,
        time: timeLabel(iv.scheduledAt),
        title: `Interview — ${[candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ")}${job?.title ? ` (${job.title})` : ""}`,
        category: "interview",
        href: "/recruitment/interviews",
      });
    }

    for (const member of members) {
      const name = String(member.name ?? "");
      if (member.dob) {
        for (const candidateDate of [new Date(now.getFullYear(), member.dob.getMonth(), member.dob.getDate())]) {
          const d = candidateDate >= windowStart ? candidateDate : new Date(now.getFullYear() + 1, member.dob.getMonth(), member.dob.getDate());
          if (d >= windowStart && d < windowEnd) {
            raw.push({
              date: d,
              title: `${name.split(" ")[0] || "Someone"}'s Birthday`,
              category: "birthday",
              href: "/profile/members",
            });
          }
        }
      }
      if (member.employmentEndDate && member.employmentEndDate >= windowStart && member.employmentEndDate < windowEnd) {
        raw.push({
          date: member.employmentEndDate,
          title: `Contract ending — ${name}`,
          category: "contract",
          href: "/profile/members",
        });
      }
    }

    const leaveByDate = new Map<string, number>();
    for (const leave of leaves) {
      const key = startOfDay(leave.startDate).toISOString();
      leaveByDate.set(key, (leaveByDate.get(key) ?? 0) + 1);
    }
    for (const [key, count] of leaveByDate) {
      raw.push({
        date: new Date(key),
        title: `${count} on leave`,
        category: "leave",
        href: "/profile/attendance",
      });
    }

    for (const offer of offers) {
      const candidate = offer.candidate as { firstName?: string; lastName?: string } | undefined;
      raw.push({
        date: offer.joiningDate,
        title: `Joining — ${[candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ") || "New hire"}`,
        category: "joining",
        href: "/recruitment/candidates",
      });
    }

    for (const meeting of meetings) {
      raw.push({
        date: meeting.date,
        time: String(meeting.time ?? ""),
        title: String(meeting.title ?? "Meeting"),
        category: "meeting",
      });
    }

    for (const holiday of holidays) {
      raw.push({
        date: holiday.startDate,
        title: `Holiday — ${String(holiday.title ?? "Company Holiday")}`,
        category: "holiday",
      });
    }
  }

  if (personalLeaves) {
    for (const leave of personalLeaves) {
      raw.push({
        date: leave.startDate,
        title: "Your leave starts",
        category: "leave",
        href: "/profile/attendance",
      });
    }
  }

  if (budgets) {
    for (const budget of budgets) {
      const board = budget.board as { title?: string; _id?: unknown } | undefined;
      const boardId = budget.board && typeof budget.board === "object" ? String((budget.board as { _id: unknown })._id) : "";
      raw.push({
        date: budget.deadline,
        title: `Milestone — ${String(board?.title ?? "Project")}`,
        category: "deadline",
        href: boardId ? `/board/${boardId}` : "/board",
      });
    }
  }

  const policyDoc = policy as unknown as { salaryCycleDay?: number } | null;
  if (policyDoc) {
    const cycleDay = Math.min(31, Math.max(1, Number(policyDoc.salaryCycleDay ?? 29)));
    let payrollDate = new Date(now.getFullYear(), now.getMonth(), cycleDay);
    if (payrollDate < windowStart) payrollDate = new Date(now.getFullYear(), now.getMonth() + 1, cycleDay);
    if (payrollDate >= windowStart && payrollDate < windowEnd) {
      raw.push({
        date: payrollDate,
        title: "Payroll processing",
        category: "payroll",
        href: "/profile/finance",
      });
    }
  }

  if (codes) {
    for (const code of codes) {
      raw.push({
        date: code.expiresAt,
        title: `Join code ${String(code.code ?? "").toUpperCase()} expires`,
        category: "it-code",
        href: "/it/board",
      });
    }
  }

  const sorted = raw
    .filter((item) => item.date >= windowStart && item.date < windowEnd)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 40);

  const sections: UpcomingSection[] = [];
  let currentKey = "";
  let currentLabel = "";
  let items: UpcomingItem[] = [];

  for (const item of sorted) {
    const day = startOfDay(item.date);
    const key = day.toISOString();
    const label = sameDay(day, startOfDay(now))
      ? "Today"
      : sameDay(day, startOfDay(addDays(now, 1)))
        ? "Tomorrow"
        : dayLabel(day);

    if (key !== currentKey) {
      if (currentKey !== "") sections.push({ label: currentLabel, items });
      currentKey = key;
      currentLabel = label;
      items = [];
    }
    items.push({
      id: `${item.category}-${day.getTime()}-${items.length}`,
      date: item.date.toISOString(),
      ...(item.time ? { time: item.time } : {}),
      title: item.title,
      category: item.category,
      ...(item.href ? { href: item.href } : {}),
    });
    if (items.length >= 8) {
      sections.push({ label: currentLabel, items });
      currentKey = "";
      currentLabel = "";
      items = [];
    }
  }
  if (currentKey !== "" && items.length > 0) sections.push({ label: currentLabel, items });

  return sections;
}