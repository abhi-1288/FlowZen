import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { Holiday } from "@/models/Holiday";
import { User } from "@/models/User";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    await connectDb();
    const user = await User.findById(userId);
    if (!user) return jsonError("User not found.", 404);
    if (user.role !== "admin") return jsonError("Only admins can add holidays.", 403);

    const { title, description, startDate, endDate } = await req.json();
    if (!startDate || !endDate) return jsonError("Start date and end date are required.");

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return jsonError("Invalid date format.");
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0) return jsonError("Invalid date range.");
    if (diffDays > 365) return jsonError("Holiday range cannot exceed 365 days.");

    const holiday = await Holiday.create({
      title: title || "Company Holiday",
      description: description || "",
      startDate: start,
      endDate: end,
      duration: diffDays,
      createdBy: userId,
    });

    return NextResponse.json({ holiday });
  } catch (err: any) {
    console.error("Holiday creation error:", err);
    return jsonError(err.message || "Failed to add holiday", 500);
  }
}


// Edit a holiday (admin only)
export async function PUT(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") return jsonError("Only admins can edit holidays.", 403);

    const { id, title, description, startDate, endDate } = await req.json();
    if (!id || !Types.ObjectId.isValid(id)) return jsonError("Invalid holiday ID.");
    const holiday = await Holiday.findById(id);
    if (!holiday) return jsonError("Holiday not found.", 404);

    if (title !== undefined) holiday.title = title;
    if (description !== undefined) holiday.description = description;
    if (startDate !== undefined) holiday.startDate = new Date(startDate);
    if (endDate !== undefined) holiday.endDate = new Date(endDate);
    if (holiday.startDate && holiday.endDate) {
      const diffTime = holiday.endDate.getTime() - holiday.startDate.getTime();
      holiday.duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    await holiday.save();
    return NextResponse.json({ holiday });
  } catch (err: any) {
    console.error("Holiday update error:", err);
    return jsonError(err.message || "Failed to update holiday", 500);
  }
}

// Delete a holiday (admin only)
export async function DELETE(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") return jsonError("Only admins can delete holidays.", 403);

    const { id } = await req.json();
    if (!id || !Types.ObjectId.isValid(id)) return jsonError("Invalid holiday ID.");
    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) return jsonError("Holiday not found.", 404);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Holiday delete error:", err);
    return jsonError(err.message || "Failed to delete holiday", 500);
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const holidays = await Holiday.find({ endDate: { $gte: new Date() } }).sort({ startDate: 1 });
  return NextResponse.json({ holidays });
}
