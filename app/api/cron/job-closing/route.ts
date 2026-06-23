import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitToUser } from "@/lib/socket-emit";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const closingJobs = await ATSJob.find({
    status: "open",
    autoCloseDate: { $gte: todayStart, $lte: todayEnd },
  }).populate("company", "name");

  const results: { jobId: string; notified: string[] }[] = [];

  for (const job of closingJobs) {
    const hrAndAdmin = await User.find({
      company: job.company,
      role: { $in: ["admin", "human-resource"] },
    });

    const notified: string[] = [];
    for (const u of hrAndAdmin) {
      const existing = await Notification.findOne({
        user: u._id,
        title: "Job Closing Today",
        message: new RegExp(job.title, "i"),
        createdAt: { $gte: todayStart },
      });
      if (existing) continue;

      await Notification.create({
        user: u._id,
        company: job.company,
        type: "deadline",
        title: "Job Closing Today",
        message: `${job.title} closes today. Review candidates before it expires.`,
        link: `/recruitment/jobs/${job._id}`,
      });

      emitToUser(String(u._id), "notification:new", {
        message: `${job.title} closes today.`,
      });

      notified.push(String(u._id));
    }

    results.push({ jobId: String(job._id), notified });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
