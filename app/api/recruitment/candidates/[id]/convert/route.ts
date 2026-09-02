import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Company } from "@/models/Company";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import { sendMail } from "@/lib/mailer";
import { employeeAccountContent } from "@/lib/email-templates";
import { buildOrigin } from "@/lib/candidate-portal";
import { parseResumeFromUrl } from "@/lib/resume-parser";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];
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
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const hrUser = await User.findById(userId);
  const isSeniorSecurity = hrUser?.role === "security" && Boolean((hrUser as any).isSeniorSecurity);
  if (!hrUser || (!HR_ROLES.includes(hrUser.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
  if (!hrUser.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: hrUser.company }).populate("job", "title department employmentType durationMonths durationDays durationHours durationYears");
  if (!candidate) return jsonError("Candidate not found.", 404);
  if (candidate.stage !== "joined") return jsonError("Candidate must be in 'Joined' stage to convert.", 400);

  const existingUser = await User.findOne({ email: candidate.email });
  if (existingUser) return jsonError("A user with this email already exists.", 409);

  const body = await request.json();
  const password = body.password;
  if (!password || password.length < 6) return jsonError("Password must be at least 6 characters.", 400);

  let role = String(body.role ?? "others").trim();
  if (!ALLOWED_CONVERT_ROLES.includes(role)) role = "others";
  if (isSeniorSecurity && role !== "security") return jsonError("Senior security can only convert to Junior Security role.", 403);

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
  }).select("offeredCTC salaryType joiningDate");

  const offerJoiningDate = (acceptedOffer as any)?.joiningDate || null;
  const offerSalaryType = String((acceptedOffer as any)?.salaryType ?? "per-annum");
  const offerCTC = Number((acceptedOffer as any)?.offeredCTC ?? 0);
  const payBasis = ["per-annum", "per-month", "per-day", "per-hour"].includes(offerSalaryType)
    ? offerSalaryType
    : "per-annum";

  const joiningDate = offerJoiningDate ? new Date(offerJoiningDate) : new Date();
  let employmentEndDate: Date | null = null;
  if ((jobDurationMonths || jobDurationDays || jobDurationHours || jobDurationYears) && ["internship", "contract", "part-time"].includes(jobEmploymentType)) {
    employmentEndDate = new Date(joiningDate);
    if (jobDurationYears) employmentEndDate.setFullYear(employmentEndDate.getFullYear() + jobDurationYears);
    if (jobDurationMonths) employmentEndDate.setMonth(employmentEndDate.getMonth() + jobDurationMonths);
    if (jobDurationDays) employmentEndDate.setDate(employmentEndDate.getDate() + jobDurationDays);
    if (jobDurationHours) employmentEndDate.setHours(employmentEndDate.getHours() + jobDurationHours);
  }

  const employee = await User.create({
    name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    email: candidate.email,
    passwordHash,
    role: role === "security" ? "security" : role,
    isSeniorSecurity: role === "security" ? false : undefined,
    company: hrUser.company,
    companyStatus: "pending",
    emailVerified: true,
    authProvider: "credentials",
    phone: candidate.phone || "",
    dob: candidate.dob || null,
    address: candidate.address || "",
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
  });

  // Best-effort: auto-fill empty personal details from the candidate's resume.
  if (candidate.resumeUrl) {
    try {
      const parsedResume = await parseResumeFromUrl(String(candidate.resumeUrl));
      const hasDob = Boolean(candidate.dob);
      if (!employee.phone && parsedResume.phone) employee.phone = parsedResume.phone;
      if (!hasDob && parsedResume.dob) {
        const dob = parseDobString(parsedResume.dob);
        if (dob && !Number.isNaN(dob.getTime())) employee.dob = dob;
      }
      if (!employee.address && parsedResume.address) employee.address = parsedResume.address;
      if (!employee.bloodGroup && parsedResume.bloodGroup) employee.bloodGroup = parsedResume.bloodGroup;
      if (!employee.emergencyContact && parsedResume.emergencyContact) employee.emergencyContact = parsedResume.emergencyContact;
      if (employee.isModified("phone") || employee.isModified("dob") || employee.isModified("address") || employee.isModified("bloodGroup") || employee.isModified("emergencyContact")) {
        await employee.save();
      }
    } catch (resumeError) {
      console.error("Resume auto-fill failed:", resumeError);
    }
  }

  const loginUrl = `${buildOrigin(request)}/login`;

  try {
    const emailContent = employeeAccountContent({
      firstName: candidate.firstName,
      companyName,
      email: candidate.email,
      password,
      loginUrl,
    });
    await sendMail({
      to: candidate.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch (emailError) {
    console.error("Welcome email failed:", emailError);
  }

  await Attendance.create({
    user: employee._id,
    date: new Date(),
    checkIn: null,
    checkOut: null,
    status: "present",
  });

  await JoinRequest.create({
    requester: employee._id,
    approver: userId,
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
    },
  });

  candidate.stage = "joined";
  await candidate.save();

  await ATSTimeline.create({
    candidate: candidate._id,
    job: candidate.job,
    action: "joined",
    metadata: { convertedBy: userId, employeeId: String(employee._id) },
    actor: userId,
    company: hrUser.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "convert-to-employee",
    entityType: "ATSCandidate",
    entityId: candidate._id,
    metadata: {
      name: `${candidate.firstName} ${candidate.lastName}`,
      employeeId: String(employee._id),
      jobTitle: job?.title,
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

  return NextResponse.json({ ok: true, employeeId: String(employee._id) });
}
