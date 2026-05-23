import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found", 404);

  return NextResponse.json({
    wfhDates: company.wfhDates || [],
    wfhCheckInMode: company.wfhCheckInMode || "all-day"
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found", 404);

  // Check if user is owner or HR
  if (String(company.owner) !== String(userId) && user.role !== "human-resource") {
    return jsonError("Only company owner or HR can manage WFH dates", 403);
  }

  const { date, startDate, endDate, reason, mode } = await request.json();

  const startStr = startDate || date;
  const endStr = endDate || startStr;

  if (!startStr) {
    return jsonError("Date/Start date is required", 400);
  }

  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return jsonError("Invalid dates provided", 400);
  }

  if (end < start) {
    return jsonError("End date must be on or after start date", 400);
  }

  const datesToAdd: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    datesToAdd.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  if (!company.wfhDates) {
    company.wfhDates = [];
  }

  let addedCount = 0;
  for (const wfhDate of datesToAdd) {
    const exists = company.wfhDates.some((d: any) => {
      const existingDate = new Date(d?.date ? d.date : d);
      existingDate.setHours(0, 0, 0, 0);
      return existingDate.getTime() === wfhDate.getTime();
    });

    if (!exists) {
      company.wfhDates.push({ date: wfhDate, reason: reason || "" });
      addedCount++;
    }
  }

  if (addedCount === 0) {
    return jsonError("Selected dates are already marked as WFH", 400);
  }

  if (mode && ["all-day", "wfh-only"].includes(mode)) {
    company.wfhCheckInMode = mode;
  }

  await company.save();

  // Send notifications to all company members
  const members = await User.find({ company: company._id, companyStatus: "approved" });
  const dateRangeStr = startStr === endStr 
    ? new Date(startStr).toLocaleDateString()
    : `${new Date(startStr).toLocaleDateString()} to ${new Date(endStr).toLocaleDateString()}`;

  for (const member of members) {
    await Notification.create({
      user: member._id,
      company: company._id,
      type: "info",
      title: "Work From Home Assigned",
      message: `Work From Home has been assigned for ${dateRangeStr}.${reason ? ` Reason: ${reason}` : ""}`
    });
    emitNotification(String(member._id));
  }

  return NextResponse.json({
    wfhDates: company.wfhDates,
    wfhCheckInMode: company.wfhCheckInMode
  });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found", 404);

  // Check if user is owner or HR
  if (String(company.owner) !== String(userId) && user.role !== "human-resource") {
    return jsonError("Only company owner or HR can manage WFH dates", 403);
  }

  const { date } = await request.json();
  if (!date) return jsonError("Date is required", 400);

  const wfhDate = new Date(date);
  wfhDate.setHours(0, 0, 0, 0);

  company.wfhDates = company.wfhDates?.filter((d: any) => {
    const existingDate = new Date(d?.date ? d.date : d);
    existingDate.setHours(0, 0, 0, 0);
    return existingDate.getTime() !== wfhDate.getTime();
  }) || [];

  await company.save();

  return NextResponse.json({
    wfhDates: company.wfhDates,
    wfhCheckInMode: company.wfhCheckInMode
  });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("User not assigned to company", 400);

  const company = await Company.findById(user.company);
  if (!company) return jsonError("Company not found", 404);

  // Check if user is owner or HR
  if (String(company.owner) !== String(userId) && user.role !== "human-resource") {
    return jsonError("Only company owner or HR can manage WFH settings", 403);
  }

  const { mode } = await request.json();
  if (!mode || !["all-day", "wfh-only"].includes(mode)) {
    return jsonError("Invalid mode. Must be 'all-day' or 'wfh-only'", 400);
  }

  company.wfhCheckInMode = mode;
  await company.save();

  return NextResponse.json({
    wfhCheckInMode: company.wfhCheckInMode
  });
}
