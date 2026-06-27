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

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const hrUser = await User.findById(userId);
  if (!hrUser || !HR_ROLES.includes(hrUser.role)) return jsonError("Forbidden", 403);
  if (!hrUser.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: hrUser.company }).populate("job", "title department");
  if (!candidate) return jsonError("Candidate not found.", 404);
  if (candidate.stage !== "joined") return jsonError("Candidate must be in 'Joined' stage to convert.", 400);

  const existingUser = await User.findOne({ email: candidate.email });
  if (existingUser) return jsonError("A user with this email already exists.", 409);

  const body = await request.json();
  const password = body.password;
  if (!password || password.length < 6) return jsonError("Password must be at least 6 characters.", 400);

  const company = await Company.findById(hrUser.company);
  const companyName = company?.name || "Company";

  const passwordHash = await bcrypt.hash(password, 12);

  const job = candidate.job as any;
  const employee = await User.create({
    name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    email: candidate.email,
    passwordHash,
    role: "others",
    company: hrUser.company,
    companyStatus: "pending",
    emailVerified: true,
    authProvider: "credentials",
  });

  const loginUrl = `${process.env.NODE_ENV === "development" ? request.headers.get("origin") || (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") : process.env.NEXT_PUBLIC_APP_URL}/login`;

  try {
    await sendMail({
      to: candidate.email,
      subject: `Your Employee Account at ${companyName}`,
      text: `Dear ${candidate.firstName},\n\nWe are pleased to inform you that your employee account at ${companyName} has been created successfully.\n\nPlease find your login credentials below:\n\n  Email:    ${candidate.email}\n  Password: ${password}\n\nSign in here: ${loginUrl}\n\nFor security reasons, we recommend changing your password after your first login.\n\nBest regards,\nHR Team\n${companyName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background: #1e293b; padding: 28px 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Welcome to ${companyName}</h1>
          </div>
          <div style="padding: 32px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">Dear ${candidate.firstName},</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">We are pleased to inform you that your employee account at <strong>${companyName}</strong> has been created successfully. You can now access the platform using the credentials provided below.</p>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 12px 6px 0; color: #6b7280; font-size: 14px; white-space: nowrap; vertical-align: top;">Email Address</td>
                  <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${candidate.email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px 6px 0; color: #6b7280; font-size: 14px; white-space: nowrap; vertical-align: top;">Password</td>
                  <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600; font-family: 'Courier New', monospace;">${password}</td>
                </tr>
              </table>
            </div>
            <a href="${loginUrl}" style="display: block; text-align: center; background: #1e293b; color: #ffffff; padding: 14px 0; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; margin: 0 0 24px;">Sign In to Your Account</a>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 4px; font-style: italic;">For security reasons, we recommend changing your password after your first login.</p>
          </div>
          <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          </div>
        </div>
      `,
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

  const acceptedOffer = await ATSOffer.findOne({
    candidate: candidate._id,
    status: "accepted",
  }).select("offeredCTC salaryType");

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
