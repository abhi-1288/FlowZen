import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";

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
  if (user.authProvider === "credentials") return jsonError("Credentials accounts use a different verification flow.", 400);
  if (user.emailVerified) return jsonError("Account is already verified.", 400);

  if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
    return jsonError("OTP expired. Request a new one.", 410);
  }

  const valid = await bcrypt.compare(otp, user.otpHash);
  if (!valid) return jsonError("Invalid OTP.", 401);

  user.emailVerified = true;
  user.otpHash = undefined;
  user.otpExpiresAt = null;
  await user.save();

  return NextResponse.json({ ok: true });
}
