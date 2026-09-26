import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError, serializeDoc } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { saveDocument, deleteFileByUrl } from "@/lib/storage";
import { publicCandidateProjection } from "@/lib/candidate-visibility";

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const job = await ATSJob.findById(candidate.job);
  if (!job) return jsonError("Job not found.", 404);
  if ((job as any).editApplicationsEnabled !== true) {
    return jsonError("Editing applications is not enabled for this job.", 403);
  }

  const form = await request.formData();

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const portfolioUrl = String(form.get("portfolioUrl") ?? "").trim();
  const linkedInUrl = String(form.get("linkedInUrl") ?? "").trim();
  const resumeFile = form.get("resume") as File | null;

  if (!firstName) return jsonError("First name is required.", 400);

  const changed: string[] = [];

  if (firstName && firstName !== candidate.firstName) changed.push("First name");
  if (lastName !== (candidate.lastName ?? "")) changed.push("Last name");
  if (phone !== (candidate.phone ?? "")) changed.push("Phone number");
  if (portfolioUrl !== (candidate.portfolioUrl ?? "")) changed.push("Portfolio URL");
  if (linkedInUrl !== (candidate.linkedInUrl ?? "")) changed.push("LinkedIn URL");

  const oldResumeUrl = (candidate as any).resumeUrl ?? "";
  let resumeUrl = oldResumeUrl;
  let newResumeFile = false;
  if (resumeFile && resumeFile.size > 0) {
    if (resumeFile.size > 20 * 1024 * 1024) return jsonError("Resume exceeds 20 MB limit.", 400);
    const ext = resumeFile.name.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${candidate._id}_${Date.now()}.${ext}`;
    const result = await saveDocument(resumeFile, key, "resumes");
    resumeUrl = result.url;
    newResumeFile = true;
    changed.push("Resume");
  }

  if (changed.length === 0) {
    return NextResponse.json({ success: true, unchanged: true, candidate: publicCandidateProjection(serializeDoc(candidate)) });
  }

  (candidate as any).firstName = firstName || candidate.firstName;
  (candidate as any).lastName = lastName;
  (candidate as any).phone = phone;
  (candidate as any).portfolioUrl = portfolioUrl;
  (candidate as any).linkedInUrl = linkedInUrl;
  if (newResumeFile) (candidate as any).resumeUrl = resumeUrl;
  await candidate.save();

  if (newResumeFile && oldResumeUrl && oldResumeUrl !== resumeUrl) {
    await deleteFileByUrl(oldResumeUrl);
  }

  await ATSTimeline.create({
    candidate: candidate._id,
    job: candidate.job,
    action: "application-updated",
    metadata: { fields: changed, resumeUrl },
    company: candidate.company,
  });

  const populated = await ATSCandidate.findById(candidate._id)
    .populate("job", "title department location employmentType salaryRangeMin salaryRangeMax salaryType currency description requiredSkills assessment assessmentDate assessmentDurationMinutes editApplicationsEnabled")
    .populate("company", "name icon primaryColor stageOrder");

  return NextResponse.json({ success: true, candidate: publicCandidateProjection(serializeDoc(populated)), changed });
}