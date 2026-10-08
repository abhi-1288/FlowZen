import { NextResponse } from "next/server";
import { sendMockTestReminderEmails } from "@/lib/assessment-mock-emails";
import { sendAssessmentReminderEmails } from "@/lib/assessment-day-emails";

/** Dev-only trigger for the combined reminder job (mock + assessment). */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const mock = await sendMockTestReminderEmails();
  const assessment = await sendAssessmentReminderEmails();
  return NextResponse.json({ ok: true, mock, assessment });
}
