import { NextResponse } from "next/server";
import { runContractEndDisconnect } from "@/lib/contract-end-disconnect";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const result = await runContractEndDisconnect();
  return NextResponse.json({ ok: true, ...result });
}