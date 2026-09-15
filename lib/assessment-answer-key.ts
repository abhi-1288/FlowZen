import { connectDb } from "@/lib/db";
import { ATSAssessment } from "@/models/ATSAssessment";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";

// The answer key is released one full day after HR applies/reviews the
// assessment results, so every candidate gets it at the same post-review time.
const REVIEW_PUBLISH_DELAY_MS = 24 * 60 * 60 * 1000;

/**
 * Publishes the question paper/answer key for assessments whose results were
 * applied by HR at least one day ago and whose key has not been released yet.
 *
 * Runs on the Vercel cron (daily) and in dev mode every 5 minutes, so in local
 * testing the key becomes available shortly after the one-day mark.
 */
export async function autoPublishAnswerKeys(): Promise<{ published: number; checked: number }> {
  await connectDb();

  const cutoff = new Date(Date.now() - REVIEW_PUBLISH_DELAY_MS);

  const assessments = await ATSAssessment.find({
    answerKeyPublished: false,
    resultsAppliedAt: { $ne: null, $lte: cutoff },
  }).select("_id job company resultsAppliedAt");

  let published = 0;

  for (const assessment of assessments as any[]) {
    // Guard: only publish while the job still has an online assessment.
    const job = await ATSJob.findById(assessment.job).select("assessment");
    if (!job || !job.assessment) continue;

    await ATSAssessment.updateOne(
      { _id: assessment._id },
      { $set: { answerKeyPublished: true, answerKeyPublishedAt: new Date() } }
    );
    published++;

    const hrAndAdmin = await User.find({ company: assessment.company, role: { $in: ["admin", "human-resource"] } });
    for (const u of hrAndAdmin) {
      await Notification.create({
        user: u._id,
        company: assessment.company,
        type: "info",
        title: "Answer Key Published",
        message: "The assessment question paper & answer key has been released to candidates.",
        link: `/recruitment/jobs/${assessment.job}`,
      });
    }
  }

  return { published, checked: assessments.length };
}