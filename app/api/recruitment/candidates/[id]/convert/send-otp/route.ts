import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { sendMail } from "@/lib/mailer";
import { otpEmailContent } from "@/lib/email-templates";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

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

  const candidate = await ATSCandidate.findOne({ _id: id, company: hrUser.company });
  if (!candidate) return jsonError("Candidate not found.", 404);
  if (candidate.stage !== "joined") return jsonError("Candidate must be in 'Joined' stage to convert.", 400);

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return jsonError("Email is required.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Enter a valid email address.", 400);
  if (email === String(candidate.email ?? "").trim().toLowerCase()) {
    return jsonError("Choose a different email to start a new account.", 400);
  }

  const existing = await User.findOne({ email }).select("_id");
  if (existing) return jsonError("This email is already registered.", 409);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(otp, 12);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  candidate.convertedEmail = email;
  candidate.conversionOtpHash = otpHash;
  candidate.conversionOtpExpiresAt = otpExpiresAt;
  await candidate.save();

  try {
    const emailContent = otpEmailContent(otp, "registration", candidate.firstName);
    await sendMail({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch (error) {
    candidate.convertedEmail = "";
    candidate.conversionOtpHash = "";
    candidate.conversionOtpExpiresAt = null;
    await candidate.save();
    return jsonError(
      error instanceof Error ? error.message : "Unable to send OTP email.",
      500,
    );
  }

  return NextResponse.json({ ok: true, email });
}
