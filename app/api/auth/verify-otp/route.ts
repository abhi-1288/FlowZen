import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { User } from "@/models/User";
import { signMobileToken } from "@/lib/mobile-auth";

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
  if (user.emailVerified) {
    const populated = await User.findById(user._id)
      .populate("company", "name primaryColor")
      .populate("team", "name");

    const companyDoc = populated?.company as { name?: string; primaryColor?: string } | null;
    const teamDoc = populated?.team as { name?: string } | null;

    const token = signMobileToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return NextResponse.json({
      ok: true,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || "",
        company: companyDoc?.name || null,
        companyColor: companyDoc?.primaryColor || null,
        team: teamDoc?.name || null,
      },
    });
  }
  if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
    return jsonError("OTP expired. Please sign up again to generate a new code.", 410);
  }

  const valid = await bcrypt.compare(otp, user.otpHash);
  if (!valid) return jsonError("Invalid OTP.", 401);

  user.emailVerified = true;
  user.otpHash = undefined;
  user.otpExpiresAt = null;
  await user.save();

  const populated = await User.findById(user._id)
    .populate("company", "name primaryColor")
    .populate("team", "name");

  const companyDoc = populated?.company as { name?: string; primaryColor?: string } | null;
  const teamDoc = populated?.team as { name?: string } | null;

  const token = signMobileToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  return NextResponse.json({
    ok: true,
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || "",
      company: companyDoc?.name || null,
      companyColor: companyDoc?.primaryColor || null,
      team: teamDoc?.name || null,
    },
  });
}
