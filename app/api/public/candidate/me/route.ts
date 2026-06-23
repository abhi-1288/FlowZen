import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError, serializeDoc } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  const hash = createHash("sha256").update(token).digest("hex");

  await connectDb();

  const candidate = await ATSCandidate.findOne({
    magicTokenHash: hash,
    magicTokenExpiresAt: { $gt: new Date() },
  })
    .populate("job", "title department location employmentType salaryRangeMin salaryRangeMax currency description requiredSkills")
    .populate("company", "name");

  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const timeline = await ATSTimeline.find({ candidate: candidate._id })
    .sort({ createdAt: -1 });

  const interviews = await ATSInterview.find({ candidate: candidate._id, status: "scheduled" })
    .sort({ scheduledAt: 1 })
    .populate("interviewer", "name");

  return NextResponse.json({
    candidate: serializeDoc(candidate),
    timeline: timeline.map((t: any) => serializeDoc(t)),
    interviews: interviews.map((i: any) => serializeDoc(i)),
  });
}
