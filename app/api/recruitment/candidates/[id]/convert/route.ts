import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Company } from "@/models/Company";
import { withCandidateAccess } from "@/lib/recruitment-candidate-access";
import { regionJoinApproverId } from "@/lib/join-approvers";
import { jsonError } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import { sendMail } from "@/lib/mailer";
import { employeeAccountContent } from "@/lib/email-templates";
import { buildOrigin } from "@/lib/candidate-portal";
import { parseResumeFromUrl } from "@/lib/resume-parser";

type Params = { params: Promise<{ id: string }> };
const ALLOWED_CONVERT_ROLES = ["employee", "project-manager", "qa-tester", "human-resource", "finance", "security", "others"];

function parseDobString(value: string): Date | null {
  const m = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return null;
  const [, d, mo, yRaw] = m;
  const year = Number(yRaw) < 100 ? 2000 + Number(yRaw) : Number(yRaw);
  const date = new Date(year, Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const access = await withCandidateAccess(id, "write");
  if (!access.ok) return access.response;
  const { user: hrUser } = access;
  const userId = String(hrUser._id);
  const isSeniorSecurity = hrUser.role === "security" && Boolean((hrUser as any).isSeniorSecurity);

  const candidate = await ATSCandidate.findById(access.candidate._id)
    .select("+conversionOtpHash")
    .populate("job", "title department employmentType durationMonths durationDays durationHours durationYears regionLabel");
  if (!candidate) return jsonError("Candidate not found.", 404);
  if (candidate.stage !== "joined") return jsonError("Candidate must be in 'Joined' stage to convert.", 400);

  const body = await request.json();
  const password = body.password;
  if (!password || password.length < 6) return jsonError("Password must be at least 6 characters.", 400);

  let role = String(body.role ?? "others").trim();
  if (!ALLOWED_CONVERT_ROLES.includes(role)) role = "others";
  if (isSeniorSecurity && role !== "security") return jsonError("Senior security can only convert to Junior Security role.", 403);

  const originalEmail = String(candidate.email ?? "").trim().toLowerCase();
  const finalEmail = String(body.email ?? candidate.email ?? "").trim().toLowerCase();
  if (!finalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
    return jsonError("Enter a valid email address.", 400);
  }
  const emailChanged = finalEmail !== originalEmail;

  const existingUser = await User.findOne({ email: finalEmail });

  if (emailChanged) {
    if (String(candidate.convertedEmail ?? "").trim().toLowerCase() !== finalEmail) {
      return jsonError("Please request a verification code for this email first.", 400);
    }
    if (!candidate.conversionOtpHash || !candidate.conversionOtpExpiresAt || candidate.conversionOtpExpiresAt.getTime() < Date.now()) {
      return jsonError("Verification code expired. Please request a new one.", 410);
    }
    const otp = String(body.otp ?? "").trim();
    if (!/^\d{6}$/.test(otp)) return jsonError("A valid 6-digit verification code is required.", 400);
    const otpValid = await bcrypt.compare(otp, String(candidate.conversionOtpHash));
    if (!otpValid) return jsonError("Invalid verification code.", 401);
    if (existingUser) return jsonError("This email is already registered.", 409);
  } else if (
    existingUser &&
    String(existingUser.company ?? "") === String(hrUser.company) &&
    ["pending", "approved"].includes(String(existingUser.companyStatus ?? ""))
  ) {
    return jsonError("A user with this email is already present in this company.", 409);
  }

  const company = await Company.findById(hrUser.company);
  const companyName = company?.name || "Company";
  const passwordHash = await bcrypt.hash(password, 12);

  const job = candidate.job as any;
  const jobEmploymentType = String(job?.employmentType ?? "");
  const jobDurationMonths = job?.durationMonths ?? null;
  const jobDurationDays = job?.durationDays ?? null;
  const jobDurationHours = job?.durationHours ?? null;
  const jobDurationYears = job?.durationYears ?? null;

  const acceptedOffer = await ATSOffer.findOne({
    candidate: candidate._id,
    status: "accepted",
  }).select("offeredCTC salaryType joiningDate regionLabel");

  const offerJoiningDate = (acceptedOffer as any)?.joiningDate || null;
  const offerSalaryType = String((acceptedOffer as any)?.salaryType ?? "per-annum");
  const offerCTC = Number((acceptedOffer as any)?.offeredCTC ?? 0);
  const payBasis = ["per-annum", "per-month", "per-day", "per-hour"].includes(offerSalaryType)
    ? offerSalaryType
    : "per-annum";

  // Which office this hire joins, and therefore which region's head approves it.
  //
  // Precedence mirrors `candidates/[id]/offer/route.ts`: the offer's stamped
  // region is the authority because that is what the receiving region agreed to
  // when it raised it. The candidate's transfer and the job's region are
  // fallbacks for hires converted without an accepted offer on file.
  const companyRegionLabels = company?.addresses?.length
    ? (company.addresses as any[]).map((a) => String(a?.label ?? "").trim()).filter(Boolean)
    : [];
  const canonicalRegion = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return companyRegionLabels.find((l) => l.toLowerCase() === raw.toLowerCase()) ?? "";
  };

  const targetRegion =
    canonicalRegion((acceptedOffer as any)?.regionLabel) ||
    canonicalRegion(candidate.joiningRegionLabel) ||
    canonicalRegion(job?.regionLabel) ||
    canonicalRegion(hrUser.regionLabel);

  // Falls back to the converting HR when the region has no head. See
  // `regionJoinApproverId`: an unconfigured head must not block an onboarding.
  const regionHeadId = targetRegion
    ? await regionJoinApproverId(hrUser.company, targetRegion)
    : "";
  const joinApproverId = regionHeadId || userId;
  const routedToRegionHead = Boolean(regionHeadId) && regionHeadId !== userId;

  const joiningDate = offerJoiningDate ? new Date(offerJoiningDate) : new Date();
  let employmentEndDate: Date | null = null;
  if ((jobDurationMonths || jobDurationDays || jobDurationHours || jobDurationYears) && ["internship", "contract", "part-time"].includes(jobEmploymentType)) {
    employmentEndDate = new Date(joiningDate);
    if (jobDurationYears) employmentEndDate.setFullYear(employmentEndDate.getFullYear() + jobDurationYears);
    if (jobDurationMonths) employmentEndDate.setMonth(employmentEndDate.getMonth() + jobDurationMonths);
    if (jobDurationDays) employmentEndDate.setDate(employmentEndDate.getDate() + jobDurationDays);
    if (jobDurationHours) employmentEndDate.setHours(employmentEndDate.getHours() + jobDurationHours);
  }

  const candidateFullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  const baseAccountFields = {
    passwordHash,
    role: role === "security" ? "security" : role,
    isSeniorSecurity: role === "security" ? false : undefined,
    company: hrUser.company,
    companyStatus: "pending",
    emailVerified: true,
    authProvider: "credentials",
    companyJoined: joiningDate,
    employmentEndDate,
    employmentType: jobEmploymentType,
    durationMonths: jobDurationMonths,
    durationDays: jobDurationDays,
    durationHours: jobDurationHours,
    durationYears: jobDurationYears,
    salaryType: payBasis,
    hourlyRate: payBasis === "per-hour" ? offerCTC : 0,
    dailyRate: payBasis === "per-day" ? offerCTC : 0,
  };

  let employee: any;
  if (!emailChanged && existingUser) {
    // Reuse the existing account: preserve its name and any existing personal data.
    const reuseFields: Record<string, unknown> = { ...baseAccountFields };
    if (candidate.phone) reuseFields.phone = candidate.phone;
    if (candidate.dob) reuseFields.dob = candidate.dob;
    if (candidate.address) reuseFields.address = candidate.address;
    employee = await User.findByIdAndUpdate(existingUser._id, reuseFields, { new: true });
  } else {
    // Email unchanged with no existing account, or a brand-new email account.
    employee = await User.create({
      email: finalEmail,
      name: candidateFullName,
      ...baseAccountFields,
      phone: candidate.phone || "",
      dob: candidate.dob || null,
      address: candidate.address || "",
    });
  }

  // Best-effort: auto-fill empty personal details from the candidate's resume.
  if (candidate.resumeUrl) {
    try {
      const parsedResume = await parseResumeFromUrl(String(candidate.resumeUrl));
      const hasDob = Boolean(candidate.dob || employee.dob);
      let resumeChanged = false;
      if (!employee.phone && parsedResume.phone) { employee.phone = parsedResume.phone; resumeChanged = true; }
      if (!hasDob && parsedResume.dob) {
        const dob = parseDobString(parsedResume.dob);
        if (dob && !Number.isNaN(dob.getTime())) { employee.dob = dob; resumeChanged = true; }
      }
      if (!employee.address && parsedResume.address) { employee.address = parsedResume.address; resumeChanged = true; }
      if (!employee.bloodGroup && parsedResume.bloodGroup) { employee.bloodGroup = parsedResume.bloodGroup; resumeChanged = true; }
      if (!employee.emergencyContact && parsedResume.emergencyContact) { employee.emergencyContact = parsedResume.emergencyContact; resumeChanged = true; }
      if (resumeChanged) {
        await employee.save();
      }
    } catch (resumeError) {
      console.error("Resume auto-fill failed:", resumeError);
    }
  }

  const loginUrl = `${buildOrigin(request)}/login`;
  const credentialRecipients = emailChanged
    ? Array.from(new Set([originalEmail, finalEmail].filter(Boolean)))
    : [finalEmail];

  for (const recipient of credentialRecipients) {
    try {
      const emailContent = employeeAccountContent({
        firstName: candidate.firstName,
        companyName,
        email: finalEmail,
        password,
        loginUrl,
      });
      await sendMail({
        to: recipient,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
    } catch (emailError) {
      console.error("Welcome email failed:", emailError);
    }
  }

  await Attendance.create({
    user: employee._id,
    date: new Date(),
    checkIn: null,
    checkOut: null,
    status: "present",
  });

  const existingPendingRequest = await JoinRequest.findOne({
    requester: employee._id,
    company: hrUser.company,
    kind: "company",
    status: "pending",
  });
  if (existingPendingRequest) {
    existingPendingRequest.status = "rejected";
    await existingPendingRequest.save();
  }

  await JoinRequest.create({
    requester: employee._id,
    approver: joinApproverId,
    company: hrUser.company,
    kind: "company",
    status: "pending",
    metadata: {
      convertedFromCandidate: id,
      designation: job?.title || "",
      department: job?.department || "",
      offeredCTC: acceptedOffer?.offeredCTC || 0,
      salaryType: acceptedOffer?.salaryType || "per-annum",
      currency: acceptedOffer?.currency || "INR",
      // The office the hire joins. `app/api/approvals/[id]/route.ts` reads this
      // to stamp the new employee's `regionLabel` on approval; it used to copy
      // the approver's region, which filed a Noida hire under whichever office
      // the approver happened to sit in.
      regionLabel: targetRegion,
      joinRoutedTo: routedToRegionHead ? "region-head" : "converting-hr",
      // Only recorded for an HR-role converter, because the approval flow
      // filters the enrolled employee by `metadata.enrollingHrId` joined against
      // the `human-resource` role. Storing it for an admin converter produced an
      // id that the role filter could never match.
      ...(hrUser.role === "human-resource" ? { enrollingHrId: userId } : {}),
    },
  });

  candidate.stage = "joined";
  if (emailChanged) {
    candidate.convertedEmail = finalEmail;
    candidate.conversionOtpHash = "";
    candidate.conversionOtpExpiresAt = null;
  }
  await candidate.save();

  await ATSTimeline.create({
    candidate: candidate._id,
    job: candidate.job,
    action: "joined",
    metadata: {
      convertedBy: userId,
      employeeId: String(employee._id),
      accountEmail: finalEmail,
      ...(emailChanged ? { originalEmail } : {}),
    },
    actor: userId,
    company: hrUser.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "convert-to-employee",
    entityType: "ATSCandidate",
    entityId: candidate._id,
    metadata: {
      name: candidateFullName,
      employeeId: String(employee._id),
      jobTitle: job?.title,
      accountEmail: finalEmail,
      regionLabel: targetRegion,
      joinApproverId,
      joinRoutedTo: routedToRegionHead ? "region-head" : "converting-hr",
      ...(emailChanged ? { originalEmail } : {}),
    },
    company: hrUser.company,
  });

  const hrUsers = await User.find({ company: hrUser.company, role: { $in: ["human-resource", "admin"] } });
  for (const hr of hrUsers) {
    await Notification.create({
      user: hr._id,
      type: "info",
      title: "Candidate Converted",
      message: `${candidate.firstName} ${candidate.lastName} has been converted to employee and is pending approval.`,
    });
    emitToUser(String(hr._id), "notification:new", {
      message: `${candidate.firstName} ${candidate.lastName} has been converted to employee.`,
    });
  }

  // The region head owns this approval now, so say so explicitly. They are very
  // likely already in the loop above, but the generic "pending approval" line
  // does not tell them this one is theirs to action or which office it lands in.
  if (routedToRegionHead) {
    const regionMessage = targetRegion
      ? `${candidateFullName} joining ${targetRegion} is pending your approval.`
      : `${candidateFullName} is pending your approval.`;
    try {
      await Notification.create({
        user: joinApproverId,
        company: hrUser.company,
        type: "info",
        title: "Join Approval Assigned to You",
        message: regionMessage,
          link: "/profile/approvals",
      });
      emitToUser(joinApproverId, "notification:new", { message: regionMessage });
    } catch (notifyErr) {
      console.error("Failed to notify region head of join approval:", notifyErr);
    }
  }

  return NextResponse.json({ ok: true, employeeId: String(employee._id) });
}
