import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitToUser } from "@/lib/socket-emit";

export async function autoCloseOverdueJobs() {
  await connectDb();
  const now = new Date();

  const overdueJobs = await ATSJob.find({
    status: "open",
    autoCloseDate: { $lt: now },
  });

  if (overdueJobs.length === 0) return 0;

  const ids = overdueJobs.map((j: any) => j._id);
  await ATSJob.updateMany(
    { _id: { $in: ids } },
    { $set: { status: "closed" } }
  );

  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

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
