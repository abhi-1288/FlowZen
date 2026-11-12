import { NextResponse, after } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { generateEmployeeCompactionDraft } from "@/lib/compaction-service";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await Attendance.findOne({ user: userId, date: today });
  if (!attendance) {
    return jsonError("You haven't checked in today.", 400);
  }

  if (attendance.checkOut) {
    return jsonError("Already checked out for today.", 400);
  }

  attendance.checkOut = new Date();
  await attendance.save();

  // Draft generation runs after the checkout response. A failure here can never
  // reverse or delay a successful checkout; the employee can regenerate the
  // draft from the compaction recovery action if it fails.
  const attendanceId = String(attendance._id);
  const checkoutAt = attendance.checkOut;
  after(async () => {
    try {
      await generateEmployeeCompactionDraft({
        employeeId: userId,
        type: "EOD",
        reportingDate: checkoutAt,
        source: "attendance_checkout",
        attendanceId,
        checkoutAt,
        requireCheckout: false,
        createdBy: userId,
      });
    } catch (error) {
      console.error("EOD compaction generation failed:", error);
    }
  });

  return NextResponse.json({ attendance });
}
