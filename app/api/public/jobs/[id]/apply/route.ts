import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { saveDocument } from "@/lib/storage";
import { jsonError } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import { createMagicLinkToken } from "@/lib/codes";
import { sendMail } from "@/lib/mailer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDb();
  const { id } = await params;

  const job = await ATSJob.findById(id);
  if (!job) return jsonError("Job not found.", 404);
  if (job.status !== "open") return jsonError("This job is no longer accepting applications.", 400);

  const form = await request.formData();

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const currentCompany = String(form.get("currentCompany") ?? "").trim();
  const experienceYears = Number(form.get("experienceYears")) || 0;
  const noticePeriod = Number(form.get("noticePeriod")) || 0;
  const notes = String(form.get("notes") ?? "").trim();
  const portfolioUrl = String(form.get("portfolioUrl") ?? "").trim();
  const linkedInUrl = String(form.get("linkedInUrl") ?? "").trim();
  const resumeFile = form.get("resume") as File | null;

  if (!firstName) return jsonError("First name is required.");
  if (!email) return jsonError("Email is required.");
  if (!resumeFile || resumeFile.size === 0) return jsonError("Resume is required.", 400);

  let resumeUrl = "";
  if (resumeFile && resumeFile.size > 0) {
    if (resumeFile.size > 20 * 1024 * 1024) return jsonError("Resume exceeds 20 MB limit.", 400);
    const ext = resumeFile.name.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${id}_${Date.now()}.${ext}`;
    const result = await saveDocument(resumeFile, key, "job-resumes");
    resumeUrl = result.url;
  }

  const candidate = await ATSCandidate.create({
    firstName,
    lastName,
    email,
    phone,
    currentCompany,
    experienceYears,
    noticePeriod,
    resumeUrl,
    portfolioUrl,
    linkedInUrl,
    source: "Company Website",
    stage: "applied",
    notes,
    job: job._id,
    company: job.company,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "applied",
    metadata: { source: "Company Website", resumeUrl },
    company: job.company,
  });

  const fullName = `${firstName} ${lastName}`.trim();
  const companyUsers = await User.find({
    company: job.company,
    role: "human-resource",
  });

  for (const u of companyUsers) {
    await Notification.create({
      user: u._id,
      company: job.company,
      type: "info",
      title: "New Application",
      message: `${fullName} applied for ${job.title}.`,
      link: `/recruitment/candidates/${candidate._id}`,
    });

    emitToUser(String(u._id), "notification:new", {
      message: `New application: ${fullName} for ${job.title}.`,
    });
  }

  const token = createMagicLinkToken();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await ATSCandidate.findByIdAndUpdate(candidate._id, {
    magicTokenHash: tokenHash,
    magicTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  });

  const origin =
    process.env.NODE_ENV === "development"
      ? new URL(request.url).origin
      : process.env.NEXT_PUBLIC_APP_URL ||
        new URL(request.url).origin ||
        process.env.NEXTAUTH_URL;
  const portalLink = `${origin}/candidate-portal?token=${encodeURIComponent(token)}`;

  try {
    await sendMail({
      to: email,
      subject: `Application received for ${job.title}`,
      text: `Hi ${firstName},\n\nThank you for applying to ${job.title}.\n\nTrack your application status here: ${portalLink}\n\nBest regards,\nThe Recruitment Team`,
      html: `<p>Hi <strong>${firstName}</strong>,</p><p>Thank you for applying to <strong>${job.title}</strong>.</p><p><a href="${portalLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Track Your Application</a></p><p>Or copy this link: <a href="${portalLink}">${portalLink}</a></p><p>Best regards,<br/>The Recruitment Team</p>`,
    });
  } catch {
    // email is best-effort
  }

  return NextResponse.json({ success: true, candidateId: candidate._id }, { status: 201 });
}
