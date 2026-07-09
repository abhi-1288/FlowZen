import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSReferral } from "@/models/ATSReferral";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { Company } from "@/models/Company";
import { saveDocument } from "@/lib/storage";
import { jsonError } from "@/lib/api";
import { companyCodePrefix } from "@/lib/company-identity";
import { emitToUser } from "@/lib/socket-emit";
import { createMagicLinkToken } from "@/lib/codes";
import { sendMail } from "@/lib/mailer";
import { applicationReceivedContent } from "@/lib/email-templates";
import { autoCloseOverdueJobs } from "@/lib/recruitment-utils";
import { parseResume } from "@/lib/resume-parser";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDb();
  await autoCloseOverdueJobs();
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
  const referralId = String(form.get("referralId") ?? "").trim();

  if (!firstName) return jsonError("First name is required.");
  if (!email) return jsonError("Email is required.");
  if (!resumeFile || resumeFile.size === 0) return jsonError("Resume is required.", 400);

  let resumeUrl = "";
  let parsedDob: string | null = null;
  let parsedAddress: string | null = null;
  if (resumeFile && resumeFile.size > 0) {
    if (resumeFile.size > 20 * 1024 * 1024) return jsonError("Resume exceeds 20 MB limit.", 400);
    const ext = resumeFile.name.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${id}_${Date.now()}.${ext}`;
    const result = await saveDocument(resumeFile, key, "job-resumes");
    resumeUrl = result.url;

    // Parse resume for additional fields (DOB, address)
    if (ext === "pdf") {
      try {
        const buffer = Buffer.from(await resumeFile.arrayBuffer());
        const parsed = await parseResume(buffer);
        parsedDob = parsed.dob || null;
        parsedAddress = parsed.address || null;
      } catch (parseErr) {
        console.error("Resume parsing error:", parseErr);
      }
    }
  }

  let referralEmployee: any = null;
  if (referralId) {
    const companyDoc = await Company.findOne({ _id: job.company });
    if (!companyDoc) return jsonError("Company not found.", 404);
    const expectedPrefix = companyCodePrefix(companyDoc.name);
    const actualPrefix = referralId.includes("-") ? referralId.slice(0, referralId.lastIndexOf("-")) : "";
    if (!actualPrefix || expectedPrefix !== actualPrefix) {
      return jsonError("Referral company does not match this job's company.");
    }
    referralEmployee = await User.findOne({
      companyIdentityCode: referralId,
      company: job.company,
    });
    if (!referralEmployee) {
      return jsonError("Referral employee not found. Please check the referral ID.");
    }
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
    source: referralEmployee ? "Referral" : "Company Website",
    stage: "applied",
    notes: notes ? [{ content: notes, author: (job as any).createdBy }] : [],
    dob: parsedDob ? new Date(parsedDob) : null,
    address: parsedAddress || "",
    job: job._id,
    company: job.company,
  });

  if (referralEmployee) {
    await ATSReferral.create({
      employee: referralEmployee._id,
      candidate: candidate._id,
      job: job._id,
      referralId,
      status: "pending",
      referralBonusEligible: false,
      company: job.company,
    });
    const candidateName = `${firstName} ${lastName}`.trim();
    await Notification.create({
      user: referralEmployee._id,
      company: job.company,
      type: "info",
      title: "New Referral Application",
      message: `${candidateName} applied using your referral for ${job.title}.`,
      link: `/recruitment/candidates/${candidate._id}`,
    });
    emitToUser(String(referralEmployee._id), "notification:new", {
      message: `${candidateName} applied using your referral for ${job.title}.`,
    });
  }

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "applied",
    metadata: { source: referralEmployee ? "Referral" : "Company Website", resumeUrl },
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
    const emailContent = applicationReceivedContent(firstName, job.title, portalLink);
    await sendMail({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch {
    // email is best-effort
  }

  return NextResponse.json({ success: true, candidateId: candidate._id }, { status: 201 });
}
