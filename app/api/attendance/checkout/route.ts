import { NextResponse, after } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { attendanceDay } from "@/lib/attendance-day";
import {
  generateEmployeeCompactionDraft,
  submitEmployeeCompaction,
} from "@/lib/compaction-service";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select("company");
  const company = user?.company
    ? await Company.findById(user.company).select("timeZone compactionAutoDeliver")
    : null;

  // Resolve "today" in the company's timezone so it matches how EOD/EOW
  // compactions and the EOD status route define the calendar day.
  const today = attendanceDay(new Date(), company?.timeZone);

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
  const autoDeliver = Boolean(company?.compactionAutoDeliver);
  after(async () => {
    try {
      const { compaction } = await generateEmployeeCompactionDraft({
        employeeId: userId,
        type: "EOD",
        reportingDate: checkoutAt,
        source: "attendance_checkout",
        attendanceId,
        checkoutAt,
        requireCheckout: false,
        createdBy: userId,
      });

      // Company opted into automatic delivery: confirm/submit the draft so it is
      // delivered to the Team Owner without a manual step. The employee can still
      // edit and resubmit afterwards. When the setting is off, the draft stays in
      // `awaiting_confirmation` for the existing manual flow.
      if (
        autoDeliver &&
        compaction &&
        String(compaction.status) === "awaiting_confirmation"
      ) {
        await submitEmployeeCompaction({
          compactionId: String(compaction._id),
          employeeId: userId,
        });
      }
    } catch (error) {
      console.error("EOD compaction generation failed:", error);
    }
  });

  return NextResponse.json({ attendance });
}
