import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError } from "@/lib/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDb();
  const { id } = await params;

  const job = await ATSJob.findById(id);
  if (!job) return jsonError("Job not found.", 404);
  if (job.status !== "open") return jsonError("This job is no longer accepting applications.", 400);

  const body = await request.json();
  if (!body.firstName || !body.firstName.trim()) return jsonError("First name is required.");
  if (!body.email || !body.email.trim()) return jsonError("Email is required.");

  const candidate = await ATSCandidate.create({
    firstName: String(body.firstName).trim(),
    lastName: String(body.lastName ?? "").trim(),
    email: String(body.email).trim().toLowerCase(),
    phone: String(body.phone ?? "").trim(),
    currentCompany: String(body.currentCompany ?? "").trim(),
    experienceYears: Number(body.experienceYears) || 0,
    source: "Company Website",
    stage: "applied",
    notes: String(body.notes ?? "").trim(),
    job: job._id,
    company: job.company,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "applied",
    metadata: { source: "Company Website" },
    company: job.company,
  });

  return NextResponse.json({ success: true, candidateId: candidate._id }, { status: 201 });
}
