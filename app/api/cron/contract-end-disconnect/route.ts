import { NextResponse } from "next/server";
import { runContractEndDisconnect } from "@/lib/contract-end-disconnect";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runContractEndDisconnect();
  return NextResponse.json({ ok: true, ...result });
}