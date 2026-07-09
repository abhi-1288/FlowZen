import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { sendMail } from "@/lib/mailer";
import { otpEmailContent } from "@/lib/email-templates";

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
    const emailContent = otpEmailContent(otp, "email-change");
    await sendMail({
      to: newEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
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
