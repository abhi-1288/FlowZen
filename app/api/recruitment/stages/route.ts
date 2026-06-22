import { NextResponse } from "next/server";
import { STAGES, STAGE_LABELS } from "@/lib/recruitment-types";

export async function GET() {
  const stages = STAGES.map((stage) => ({
    id: stage,
    label: STAGE_LABELS[stage],
  }));
  return NextResponse.json({ stages });
}
