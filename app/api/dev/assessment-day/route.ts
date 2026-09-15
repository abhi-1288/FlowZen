import { NextResponse } from "next/server";
import { sendAssessmentReminderEmails } from "@/lib/assessment-day-emails";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const result = await sendAssessmentReminderEmails();
  return NextResponse.json({ ok: true, ...result });
}