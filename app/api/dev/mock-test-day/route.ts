import { NextResponse } from "next/server";
import { sendMockTestInvitationEmails } from "@/lib/assessment-mock-emails";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const result = await sendMockTestInvitationEmails();
  return NextResponse.json({ ok: true, ...result });
}
