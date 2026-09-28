import { NextResponse } from "next/server";
import { sendEditApplicationInvites } from "@/lib/edit-application-emails";

/**
 * Sends pending application-editing invites.
 *
 * Hourly rather than daily: a candidate who applies while the window is open
 * should hear about it the same day, not up to 24 hours later. The per-candidate
 * `editApplicationInviteSentAt` marker makes the extra frequency free — a second
 * run with nobody outstanding does one indexed query and no mail.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendEditApplicationInvites();
  return NextResponse.json({ ok: true, ...result });
}
