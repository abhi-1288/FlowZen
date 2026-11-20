import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { sendMail } from "@/lib/mailer";
import { fmtJobDateTime as fmtDateTime } from "@/lib/date-utils";
import { buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { editApplicationsEnabledEmail } from "@/lib/email-templates";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const user = await User.findById(userId).select("company").lean();
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;

  await connectDb();
  const job = await ATSJob.findOne({ _id: id, company: (user as any).company });
  if (!job) return jsonError("Job not found.", 404);
  if (!(job as any).editApplicationsEnabled || !(job as any).editApplicationsCloseAt)
    return jsonError("Enable the edit application window first.", 400);

  const candidates = await ATSCandidate.find({ job: id, company: (user as any).company }).select("firstName lastName email");
  const close = fmtDateTime(new Date((job as any).editApplicationsCloseAt).toISOString());
  const opens = fmtDateTime(new Date().toISOString());
  const companyDoc = await Company.findById((user as any).company).select("name icon").lean();
  const brand = { name: (companyDoc as any)?.name, icon: (companyDoc as any)?.icon };
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  let emailed = 0;
  for (const c of candidates) {
    try {
      const token = await resolveCandidatePortalToken(String(c._id), { force: true });
      const content = editApplicationsEnabledEmail({
        candidateName: `${c.firstName} ${c.lastName}`.trim(),
        jobTitle: (job as any).title,
        portalLink: token ? buildPortalLink(origin, token) : undefined,
        company: brand,
        opensAtLabel: opens,
        closesAtLabel: close,
      });
      await sendMail({ to: c.email, subject: content.subject, text: content.text, html: content.html });
      emailed++;
    } catch { /* skip failures */ }
  }
  return NextResponse.json({ ok: true, emailed });
}
