import { NextResponse } from "next/server";
import { autoPublishAnswerKeys } from "@/lib/assessment-answer-key";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autoPublishAnswerKeys();
  return NextResponse.json({ ok: true, ...result });
}