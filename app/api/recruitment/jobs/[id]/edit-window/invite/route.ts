import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { sendMail } from "@/lib/mailer";
import { fmtJobDateTime as fmtDateTime } from "@/lib/date-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const user = await User.findById(userId).select("company role").lean();
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;

  await connectDb();
  const job = await ATSJob.findOne({ _id: id, company: (user as any).company });
  if (!job) return jsonError("Job not found.", 404);
  if (!(job as any).editApplicationsEnabled || !(job as any).editApplicationsCloseAt)
    return jsonError("Enable the edit application window first.", 400);

  const candidates = await ATSCandidate.find({ job: id, company: (user as any).company }).select("firstName email");
  const close = fmtDateTime(new Date((job as any).editApplicationsCloseAt).toISOString());
  const opens = fmtDateTime(new Date().toISOString());
  let emailed = 0;
  for (const c of candidates) {
    try {
      await sendMail({
        to: c.email,
        subject: `You can now edit your application — ${job.title}`,
        text: `Hello ${c.firstName},\n\nThe application editing window for ${job.title} is now open.\n\nOpens: ${opens}\nCloses: ${close}\n\nPlease update your details before the window closes.`,
        html: `<p>Hello ${c.firstName},</p><p>The application editing window for <strong>${job.title}</strong> is now open.</p><p><strong>Opens:</strong> ${opens}<br/><strong>Closes:</strong> ${close}</p><p>Please update your details before the window closes.</p>`,
      });
      emailed++;
    } catch { /* skip failures */ }
  }
  return NextResponse.json({ ok: true, emailed });
}
