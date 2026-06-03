import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { sendMail } from "@/lib/mailer";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (user.authProvider === "credentials") return jsonError("Credentials accounts already use email verification.", 400);
  if (user.emailVerified) return jsonError("Account is already verified.", 400);
  if (user.role !== "others") return jsonError("Only 'others' role accounts need verification.", 400);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(otp, 12);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.otpHash = otpHash;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  try {
    await sendMail({
      to: user.email,
      subject: "Verify your FlowZen account",
      text: ` FlowZen Verification

      Hello ${user.name},

    Use the verification code below to complete your account setup:

    ${otp}

    This code will expire in 10 minutes.

    If you didn't request this code, you can safely ignore this email.

    — Team FlowZen`,
      html: `<div style="background:linear-gradient(135deg,#10b981,#059669); padding:32px; text-align:center;"> <h1 style="margin:0; color:white; font-size:28px;">🌿 FlowZen</h1> <p style="margin-top:8px; color:#d1fae5; font-size:14px;"> Account Verification </p> </div> <div style="padding:36px 32px;"> <p style="font-size:16px; margin-bottom:18px;"> Hello ${user.name}, </p> <p style="font-size:15px; line-height:1.7; color:#4b5563;"> Use the verification code below to complete your FlowZen account setup. </p> <div style=" margin:32px 0; text-align:center; background:#ecfdf5; border:2px dashed #10b981; border-radius:14px; padding:22px; "> <div style=" font-size:36px; font-weight:700; letter-spacing:8px; color:#059669; "> ${otp} </div> </div> <p style="font-size:14px; color:#6b7280; line-height:1.6;"> ⏳ This code expires in <strong>10 minutes</strong>. </p> <p style="font-size:14px; color:#6b7280; line-height:1.6;"> If you didn't request this verification code, you can safely ignore this email. </p> </div> <div style=" background:#f9fafb; padding:18px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; "> © 2026 FlowZen • Secure Authentication System </div>`,
    });
  } catch (error) {
    user.otpHash = undefined;
    user.otpExpiresAt = null;
    await user.save();
    return jsonError(
      error instanceof Error ? error.message : "Unable to send OTP email.",
      500,
    );
  }

  return NextResponse.json({ message: "OTP sent to your email." });
}
