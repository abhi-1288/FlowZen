import { NextResponse } from "next/server";
import { jsonError, requireUserId } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

function normalizeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function monthDates(month: string, days: number[]) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;

  const allowedDays = new Set(days);
  const result: Date[] = [];
  const date = new Date(year, monthIndex, 1);
  while (date.getMonth() === monthIndex) {
    if (allowedDays.has(date.getDay())) {
      const next = new Date(date);
      next.setHours(0, 0, 0, 0);
      result.push(next);
    }
    date.setDate(date.getDate() + 1);
  }
  return result;
}

async function getAdminCompany(userId: string) {
  const user = await User.findById(userId).select("company role");
  if (!user?.company) return { error: jsonError("User not assigned to company", 400) };

  const company = await Company.findById(user.company);
  if (!company) return { error: jsonError("Company not found", 404) };
  if (String(company.owner) !== String(userId) || String(user.role) !== "admin") {
    return { error: jsonError("Only company admin can manage weekends", 403) };
  }

  return { company };
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const { company, error } = await getAdminCompany(userId);
  if (error) return error;

  const body = await request.json();
  const month = String(body.month ?? "");
  const days = Array.isArray(body.days)
    ? body.days.map(Number).filter((day: number) => day === 0 || day === 6)
    : [];
  if (!days.length) return jsonError("Select Saturday, Sunday, or both.");

  const dates = monthDates(month, days);
  if (!dates) return jsonError("Valid month is required.");

  const existing = new Set(
    ((company as any).weekendDates ?? []).map((item: any) => {
      const date = normalizeDate(String(item.date));
      return date ? date.getTime() : 0;
    }),
  );

  const additions = dates
    .filter((date) => !existing.has(date.getTime()))
    .map((date) => ({ date, reason: "Manual weekend" }));

  (company as any).weekendDates.push(...additions);
  await company.save();

  if (additions.length > 0) {
    const populatedCompany = await Company.findById(company._id).select("members owner name");
    if (populatedCompany) {
      const targets = new Set<string>(
        (populatedCompany.members ?? []).map((member: any) => String(member))
      );
      if (populatedCompany.owner) targets.add(String(populatedCompany.owner));

      const monthName = new Date(month + "-01").toLocaleString("en-US", { month: "long" });
      const hasSat = days.includes(6);
      const hasSun = days.includes(0);
      const dayNames = hasSat && hasSun ? "every saturday and sunday" : hasSat ? "every saturday" : "every sunday";
      const body = `${populatedCompany.name} has decided to give a weekend on ${dayNames} of ${monthName}. thanks`;

      await Notification.insertMany(
        Array.from(targets).map((targetUserId) => ({
          user: targetUserId,
          company: populatedCompany._id,
          type: "system",
          title: "Weekends Assigned",
          body,
        }))
      );
      Array.from(targets).forEach((target) => emitNotification(target));
    }
  }

  return NextResponse.json({ weekendDates: (company as any).weekendDates || [] });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const { company, error } = await getAdminCompany(userId);
  if (error) return error;

  const body = await request.json();
  const targetDate = normalizeDate(String(body.date ?? ""));
  if (!targetDate) return jsonError("Date is required.");

  (company as any).weekendDates = ((company as any).weekendDates ?? []).filter((item: any) => {
    const date = normalizeDate(String(item.date));
    return !date || date.getTime() !== targetDate.getTime();
  });

  await company.save();
  return NextResponse.json({ weekendDates: (company as any).weekendDates || [] });
}
