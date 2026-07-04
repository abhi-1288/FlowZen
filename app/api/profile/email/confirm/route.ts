import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const otp = String(body.otp ?? "").trim();

  if (!/^\d{6}$/.test(otp)) {
    return jsonError("A valid 6-digit OTP is required.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("+otpHash +otpExpiresAt");
  if (!user) return jsonError("User not found.", 404);

  if (!user.pendingEmail) {
    return jsonError("No pending email change. Please start the email change process again.", 400);
  }

  if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
    user.pendingEmail = null;
    user.otpHash = undefined;
    user.otpExpiresAt = null;
    await user.save();
    return jsonError("OTP expired. Please start the email change process again.", 410);
  }

  const valid = await bcrypt.compare(otp, user.otpHash);
  if (!valid) return jsonError("Invalid OTP.", 401);

  const existing = await User.findOne({ email: user.pendingEmail });
  if (existing) {
    user.pendingEmail = null;
    user.otpHash = undefined;
    user.otpExpiresAt = null;
    await user.save();
    return jsonError("This email is already in use by another account.", 409);
  }

  user.email = user.pendingEmail;
  user.emailVerified = true;
  user.pendingEmail = null;
  user.otpHash = undefined;
  user.otpExpiresAt = null;
  await user.save();

  return NextResponse.json({ ok: true, message: "Email updated successfully." });
}
