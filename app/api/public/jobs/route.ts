import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { serializeDoc } from "@/lib/api";

export async function GET() {
  await connectDb();

  const jobs = await ATSJob.find({ status: "open" })
    .populate("company", "name icon")
    .sort({ createdAt: -1 });

  const grouped: Record<string, { company: any; jobs: any[] }> = {};
  for (const job of jobs) {
    const serialized = serializeDoc(job) as any;
    const company = serialized.company as any;
    const companyId = company?.id ?? String(serialized.company);
    if (!grouped[companyId]) {
      grouped[companyId] = { company, jobs: [] };
    }
    grouped[companyId].jobs.push(serialized);
  }

  return NextResponse.json({ companies: Object.values(grouped) });
}
