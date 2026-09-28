import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Company } from "@/models/Company";
import { buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { editApplicationsEnabledEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { isEditWindowOpen } from "@/lib/recruitment-utils";

/**
 * Sends the "update your application" invite for every job with an open editing
 * window.
 *
 * This used to run inside the PATCH that enabled editing, awaiting a mail
 * round-trip and a portal-token write per candidate while the HTTP request was
 * still open — which times out on a job with a few hundred applicants and
 * leaves the button showing "done" for an invite that never went out. Sending
 * from a scheduled job instead makes it:
 *
 *   - idempotent, via `editApplicationInviteSentAt`, so a retry after a partial
 *     failure only picks up who is still missing one;
 *   - independent of the request, so a timeout cannot lose an invite.
 *
 * Each candidate's token is rotated (`force`) because the enable handler has just
 * cleared their marker and they are about to be handed a brand new link. That is
 * the one caller permitted to break the "never rotate a stored token" rule in
 * lib/candidate-portal.ts.
 */

export type InviteSendResult = { emailed: number; jobsChecked: number; candidatesChecked: number };

export async function sendEditApplicationInvites(
  options?: { jobId?: string }
): Promise<InviteSendResult> {
  await connectDb();

  const filter: Record<string, unknown> = { editApplicationsEnabled: true };
  if (options?.jobId) filter._id = options.jobId;

  const jobs = await ATSJob.find(filter);
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  let emailed = 0;
  let candidatesChecked = 0;

  for (const job of jobs) {
    // Read the window, don't just the flag. A job whose deadline has passed but
    // whose sweep has not run yet must not receive an invite to a closed form.
    if (!isEditWindowOpen(job).open) continue;

    const closeAt = job.editApplicationsCloseAt ? new Date(job.editApplicationsCloseAt) : null;
    // A UTC wall clock (lib/date-utils), so it is formatted in UTC to match the
    // value the candidate typed into the HR form.
    const closesAtLabel = closeAt
      ? closeAt.toLocaleString("en-IN", {
          timeZone: "UTC",
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "";

    // Hoisted out of the candidate loop: the company is the same for all of them.
    const companyDoc = await Company.findById(job.company).select("name icon").lean();
    const brand = { name: (companyDoc as any)?.name, icon: (companyDoc as any)?.icon };

    const candidates = await ATSCandidate.find({
      job: job._id,
      company: job.company,
      email: { $ne: "" },
      editApplicationInviteSentAt: null,
    }).select("firstName lastName email");

    candidatesChecked += candidates.length;

    for (const candidate of candidates) {
      try {
        const token = await resolveCandidatePortalToken(String(candidate._id), { force: true });
        if (!token || !candidate.email) continue;
        const emailContent = editApplicationsEnabledEmail({
          candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
          jobTitle: job.title,
          portalLink: buildPortalLink(origin, token),
          company: brand,
          closesAtLabel,
        });
        // Stamped before the send, not after: a crash mid-send would otherwise
        // re-send to everyone on the next run, and a duplicate invite to a
        // candidate is worse than one that had to be retried.
        await ATSCandidate.findByIdAndUpdate(candidate._id, {
          editApplicationInviteSentAt: new Date(),
        });
        await sendMail({
          to: candidate.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });
        emailed++;
      } catch (err) {
        // Cleared so the next run retries this one candidate rather than
        // silently dropping them.
        await ATSCandidate.findByIdAndUpdate(candidate._id, {
          editApplicationInviteSentAt: null,
        }).catch(() => {});
        console.error(`Edit-application invite failed for ${candidate._id}:`, err);
      }
    }
  }

  return { emailed, jobsChecked: jobs.length, candidatesChecked };
}
