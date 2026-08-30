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
    .populate("job", "title department location employmentType salaryRangeMin salaryRangeMax salaryType currency description requiredSkills")
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

  return NextResponse.json({
    candidate: serializeDoc(candidate),
    timeline: timeline.map((t: any) => serializeDoc(t)),
    interviews: interviews.map((i: any) => serializeDoc(i)),
    offer: offer ? serializeDoc(offer) : null,
  });
}
