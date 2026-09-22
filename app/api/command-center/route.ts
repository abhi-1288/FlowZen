import { NextResponse } from "next/server";
import { jsonError, requireUserId } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { buildCommandCenter, parsePeriod } from "@/lib/command-center";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));

  try {
    const payload = await buildCommandCenter({ userId, period });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[command-center] failed", error);
    return jsonError("Could not build the command center.", 500);
  }
}