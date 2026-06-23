import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { serializeDoc } from "@/lib/api";
import { jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDb();
  const { id } = await params;

  const job = await ATSJob.findOne({ _id: id, status: "open" }).populate("company", "name icon");
  if (!job) return jsonError("Job not found.", 404);

  return NextResponse.json({ job: serializeDoc(job) });
}
