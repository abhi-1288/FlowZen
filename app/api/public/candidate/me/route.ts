import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError, serializeDoc } from "@/lib/api";
import { createUniqueGuestPassCode, findCandidateByToken } from "@/lib/candidate-portal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const more = await ATSCandidate.findById(candidate._id)
    .populate("job", "title department location employmentType salaryRangeMin salaryRangeMax salaryType currency description requiredSkills assessment assessmentDate assessmentDurationMinutes")
    .populate("company", "name icon primaryColor");

  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const timeline = await ATSTimeline.find({ candidate: candidate._id })
    .sort({ createdAt: -1 });

  const interviews = await ATSInterview.find({ candidate: candidate._id, status: "scheduled" })
    .sort({ scheduledAt: 1 })
    .populate("interviewer", "name");

  // Lazy backfill: ensure in-person scheduled interviews carry a scannable guest
  // pass code so existing candidates' ID cards and QR verifications work.
  const companyId = String(candidate.company);
  for (const int of interviews as any[]) {
    if (!int.passCode && !int.meetingLink && int.location) {
      const code = await createUniqueGuestPassCode(companyId);
      int.passCode = code;
      await ATSInterview.updateOne({ _id: int._id }, { $set: { passCode: code } });
      await ATSTimeline.create({
        candidate: candidate._id,
        job: int.job,
        action: "note-added",
        metadata: { text: `Guest pass code generated: ${code}` },
        company: candidate.company,
      });
    }
  }

  const offer = await ATSOffer.findOne({ candidate: candidate._id, company: candidate.company })
    .populate("job", "title")
    .sort({ createdAt: -1 });

  // Assessment info for portal
  const jobDoc = (more as any)?.job;
  const now = new Date();
  let assessmentPayload: any = null;
  if (jobDoc && jobDoc.assessment) {
    const isOpen = (() => {
      if (!jobDoc.assessmentDate) return false;
      const d = new Date(jobDoc.assessmentDate);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    })();
    const isSubmitted = Boolean((candidate as any).assessmentSubmittedAt);
    const isStarted = Boolean((candidate as any).assessmentStartedAt) && !isSubmitted;
    const startedAt = (candidate as any).assessmentStartedAt ? new Date((candidate as any).assessmentStartedAt) : null;
    const durationMin = jobDoc.assessmentDurationMinutes || null;
    const endsAt = startedAt && durationMin ? new Date(startedAt.getTime() + durationMin * 60 * 1000).toISOString() : null;
    assessmentPayload = {
      enabled: true,
      date: jobDoc.assessmentDate ? jobDoc.assessmentDate.toISOString() : null,
      durationMinutes: durationMin,
      stage: candidate.stage,
      startedAt: (candidate as any).assessmentStartedAt || null,
      submittedAt: (candidate as any).assessmentSubmittedAt || null,
      score: (candidate as any).assessmentScore ?? null,
      status: (candidate as any).assessmentStatus || "pending",
      reason: (candidate as any).assessmentReason || "",
      rejectionNote: (candidate as any).assessmentRejectionNote || "",
      eligibleToStart: isOpen && ["screening", "assessment"].includes(candidate.stage) && !isStarted && !isSubmitted,
      submittable: isStarted,
      endsAt,
    };
  }

  return NextResponse.json({
    candidate: serializeDoc(more ?? candidate),
    timeline: timeline.map((t: any) => serializeDoc(t)),
    interviews: interviews.map((i: any) => serializeDoc(i)),
    offer: offer ? serializeDoc(offer) : null,
    assessment: assessmentPayload,
  });
}
