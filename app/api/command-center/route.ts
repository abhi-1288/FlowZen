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
  // Advisory. Honoured only for the company owner and for a region's HR/Admin
  // head; everyone else is pinned to their own region. The response always
  // reports the scope that was actually applied, so a viewer whose `region` was
  // ignored can see the truth rather than the region they asked for.
  const region = url.searchParams.get("region");

  try {
    const payload = await buildCommandCenter({ userId, period, region });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[command-center] failed", error);
    return jsonError("Could not build the command center.", 500);
  }
}