import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { User } from "@/models/User";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const otp = String(body.otp ?? "").trim();

  if (!email || !/^\d{6}$/.test(otp)) {
    return jsonError("Email and a valid 6-digit OTP are required.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findOne({ email }).select("+otpHash +otpExpiresAt");
  if (!user) return jsonError("Account not found.", 404);
  if (user.emailVerified) return NextResponse.json({ ok: true });
  if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
    return jsonError("OTP expired. Please sign up again to generate a new code.", 410);
  }

  const valid = await bcrypt.compare(otp, user.otpHash);
  if (!valid) return jsonError("Invalid OTP.", 401);

  user.emailVerified = true;
  user.otpHash = undefined;
  user.otpExpiresAt = null;
  await user.save();

  return NextResponse.json({
    ok: true,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}
