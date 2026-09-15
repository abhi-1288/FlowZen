import { NextResponse } from "next/server";
import { autoPublishAnswerKeys } from "@/lib/assessment-answer-key";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const result = await autoPublishAnswerKeys();
  return NextResponse.json({ ok: true, ...result });
}