import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitToUser } from "@/lib/socket-emit";
import { utcWallClockNow } from "@/lib/date-utils";

/**
 * Closes open jobs whose `autoCloseDate` has passed and notifies HR.
 *
 * `autoCloseDate` is a wall clock (see lib/date-utils), so it is compared against
 * the current wall clock rather than the raw instant — otherwise a job set to
 * close at 23:59 would trip five and a half hours early on an IST host.
 */
export async function autoCloseOverdueJobs() {
  await connectDb();
  const now = new Date();
  const wallClockNow = utcWallClockNow(now);

  const overdueJobs = await ATSJob.find({
    status: "open",
    autoCloseDate: { $lt: new Date(wallClockNow) },
  });

  if (overdueJobs.length === 0) return 0;

  const ids = overdueJobs.map((j: any) => j._id);
  await ATSJob.updateMany(
    { _id: { $in: ids } },
    { $set: { status: "closed" } }
  );

  // Read the UTC components so the date in the notification matches the wall
  // clock the job was scheduled against, not the host's local one.
  const dateStr = `${now.getUTCDate()}/${now.getUTCMonth() + 1}/${now.getUTCFullYear()}`;

  for (const job of overdueJobs) {
    const companyId = job.company;

    const allCandidates = await ATSCandidate.find({ job: job._id, company: companyId });
    const active = allCandidates.filter(
      (c: any) => !["joined", "rejected"].includes(c.stage)
    ).length;
    const accepted = allCandidates.filter((c: any) => c.stage === "joined").length;
    const rejected = allCandidates.filter((c: any) => c.stage === "rejected").length;

    const hrAndAdmin = await User.find({
      company: companyId,
      role: { $in: ["admin", "human-resource"] },
    });

    for (const u of hrAndAdmin) {
      await Notification.create({
        user: u._id,
        company: companyId,
        type: "deadline",
        title: "Job Auto-Closed",
        message: `${job.title} post has been auto-closed on ${dateStr} with active candidate: ${active}, accepted ${accepted}, rejected ${rejected}`,
        link: `/recruitment/jobs/${job._id}`,
      });

      emitToUser(String(u._id), "notification:new", {
        message: `${job.title} post has been auto-closed on ${dateStr}.`,
      });
      emitToUser(String(u._id), "recruitment:update", {});
    }
  }

  return overdueJobs.length;
}

/**
 * Re-exported so server code has a single import to reach, but defined in
 * `lib/edit-window.ts`: the HR job page and the candidate portal need these from
 * `"use client"` files, and this module's own `connectDb` and model imports
 * cannot be dragged into a browser bundle.
 */
export {
  MAX_EDIT_WINDOW_MS,
  isEditWindowOpen,
  validateEditWindowDeadline,
  type EditWindowState,
} from "@/lib/edit-window";

/**
 * Flips editing off for every job whose window has passed, and tells HR.
 *
 * Purely housekeeping: `isEditWindowOpen` already refuses the write at the
 * deadline, so this exists to make the stored flag honest (so the job page does
 * not show "editing open" for a window that is closed) and to leave a record.
 * Candidates are not emailed — they were told the date when it was set.
 */
export async function closeExpiredEditWindows(): Promise<{ closed: number }> {
  await connectDb();

  const overdue = await ATSJob.find({
    editApplicationsEnabled: true,
    editApplicationsCloseAt: { $ne: null, $lte: new Date(utcWallClockNow()) },
  });
  if (overdue.length === 0) return { closed: 0 };

  const ids = overdue.map((j: any) => j._id);
  await ATSJob.updateMany({ _id: { $in: ids } }, { $set: { editApplicationsEnabled: false } });

  for (const job of overdue) {
    const when = new Date(job.editApplicationsCloseAt)
      .toISOString()
      .replace("T", " ")
      .slice(0, 16);
    const recipients = await User.find({
      company: job.company,
      role: { $in: ["admin", "human-resource"] },
    });
    for (const u of recipients) {
      await Notification.create({
        user: u._id,
        company: job.company,
        type: "deadline",
        title: "Application Editing Closed",
        message: `The application editing window for ${job.title} closed on ${when} UTC. Candidates can no longer update their applications.`,
        link: `/recruitment/jobs/${job._id}`,
      });
      emitToUser(String(u._id), "notification:new", {
        message: `Application editing has closed for ${job.title}.`,
      });
      emitToUser(String(u._id), "recruitment:update", {});
    }
  }

  return { closed: overdue.length };
}

/** Exported for the token-rotation check in the enable handler. */
export const PORTAL_TOKEN_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
