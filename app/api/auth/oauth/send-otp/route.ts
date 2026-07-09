import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { sendMail } from "@/lib/mailer";
import { otpEmailContent } from "@/lib/email-templates";

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
    const emailContent = otpEmailContent(otp, "account-verification", user.name);
    await sendMail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
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
