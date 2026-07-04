import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { sendMail } from "@/lib/mailer";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const currentEmail = String(body.currentEmail ?? "").trim().toLowerCase();
  const currentPassword = String(body.currentPassword ?? "");
  const newEmail = String(body.newEmail ?? "").trim().toLowerCase();

  if (!currentEmail || !currentPassword || !newEmail) {
    return jsonError("Current email, current password, and new email are required.");
  }

  if (currentEmail === newEmail) {
    return jsonError("New email is the same as your current email.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("+passwordHash");
  if (!user) return jsonError("User not found.", 404);

  if (user.email !== currentEmail) {
    return jsonError("Current email does not match our records.", 400);
  }

  if (user.authProvider === "credentials") {
    if (!user.passwordHash) return jsonError("No local password is set for this account.", 400);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return jsonError("Current password is incorrect.", 401);
  }

  const existing = await User.findOne({ email: newEmail });
  if (existing) return jsonError("This email is already in use by another account.", 409);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(otp, 12);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.pendingEmail = newEmail;
  user.otpHash = otpHash;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  try {
    await sendMail({
      to: newEmail,
      subject: "Your FlowZen Email Change OTP",
      text: ` FlowZen Email Change
      
      Hello,

    Use the verification code below to confirm your new email address on FlowZen:

    ${otp}

    This code will expire in 10 minutes.

    If you didn't request this change, please secure your account immediately.

    — Team FlowZen`,
      html: `<div style="background:linear-gradient(135deg,#10b981,#059669); padding:32px; text-align:center;"> <h1 style="margin:0; color:white; font-size:28px;">🌿 FlowZen</h1> <p style="margin-top:8px; color:#d1fae5; font-size:14px;"> Email Change Verification </p> </div> <div style="padding:36px 32px;"> <p style="font-size:16px; margin-bottom:18px;"> Hello, </p> <p style="font-size:15px; line-height:1.7; color:#4b5563;"> Use the verification code below to confirm your new email address on FlowZen. </p> <div style=" margin:32px 0; text-align:center; background:#ecfdf5; border:2px dashed #10b981; border-radius:14px; padding:22px; "> <div style=" font-size:36px; font-weight:700; letter-spacing:8px; color:#059669; "> ${otp} </div> </div> <p style="font-size:14px; color:#6b7280; line-height:1.6;"> ⏳ This code expires in <strong>10 minutes</strong>. </p> <p style="font-size:14px; color:#6b7280; line-height:1.6;"> If you didn't request this change, please secure your account immediately. </p> </div> <div style=" background:#f9fafb; padding:18px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; "> © 2026 FlowZen • Secure Authentication System </div>`,
    });
  } catch (error) {
    user.pendingEmail = null;
    user.otpHash = undefined;
    user.otpExpiresAt = null;
    await user.save();
    return jsonError(
      error instanceof Error ? error.message : "Unable to send OTP email.",
      500,
    );
  }

  return NextResponse.json({ message: "OTP sent to your new email." });
}
