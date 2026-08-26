import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { ATSTimeline } from "@/models/ATSTimeline";
import { extractResumeText, scoreResumeWithGemini } from "@/lib/ats-scorer";

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company });
  if (!job) return jsonError("Job not found.", 404);

  const threshold = (job as any).atsScoreThreshold;
  if (threshold == null) return jsonError("Set an ATS score threshold on this job before running ATS scoring.", 400);

  const body = await request.json().catch(() => ({}));
  const force = Boolean(body.force);

  const filter: Record<string, unknown> = { job: job._id, company: user.company };
  if (!force) {
    filter.atsScore = null;
  }

  const candidates = await ATSCandidate.find(filter);
  if (candidates.length === 0) return jsonError(force ? "No candidates to re-score." : "All candidates already scored.", 400);

  let scored = 0;
  let selected = 0;
  let rejected = 0;
  let errors = 0;

  for (const candidate of candidates) {
    try {
      const resumeUrl = (candidate as any).resumeUrl;
      if (!resumeUrl) {
        errors++;
        continue;
      }

      const resumeText = await extractResumeText(resumeUrl);
      if (!resumeText.trim()) {
        await ATSCandidate.findByIdAndUpdate(candidate._id, {
          atsScore: 0,
          atsStatus: "rejected",
          atsReason: "Could not extract text from resume.",
          atsScoredAt: new Date(),
        });
        rejected++;
        scored++;
        continue;
      }

      const result = await scoreResumeWithGemini(
        resumeText,
        (job as any).description || "",
        (job as any).requiredSkills || [],
        (job as any).requiredExperienceYears ?? null,
      );

      const status = result.score >= threshold ? "selected" : "rejected";

      await ATSCandidate.findByIdAndUpdate(candidate._id, {
        atsScore: result.score,
        atsStatus: status,
        atsReason: result.reason,
        atsScoredAt: new Date(),
      });

      await ATSTimeline.create({
        candidate: candidate._id,
        job: job._id,
        action: "note-added",
        metadata: { content: `ATS Score: ${result.score}/100 (${status}). ${result.reason}` },
        company: user.company,
      });

      scored++;
      if (status === "selected") selected++;
      else rejected++;
    } catch (err) {
      console.error(`ATS scoring failed for candidate ${candidate._id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({
    scored,
    selected,
    rejected,
    errors,
    threshold,
    total: candidates.length,
  });
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("atsScoreThreshold");
  if (!job) return jsonError("Job not found.", 404);

  const [total, pending, selected, rejected] = await Promise.all([
    ATSCandidate.countDocuments({ job: id, company: user.company }),
    ATSCandidate.countDocuments({ job: id, company: user.company, atsScore: null }),
    ATSCandidate.countDocuments({ job: id, company: user.company, atsStatus: "selected" }),
    ATSCandidate.countDocuments({ job: id, company: user.company, atsStatus: "rejected" }),
  ]);

  return NextResponse.json({
    threshold: (job as any).atsScoreThreshold,
    total,
    pending,
    selected,
    rejected,
  });
}
