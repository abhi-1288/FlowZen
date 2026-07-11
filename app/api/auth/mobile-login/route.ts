import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { signMobileToken } from "@/lib/mobile-auth";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return jsonError("Email and password are required.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    return jsonError("Invalid email or password.", 401);
  }

  if (!user.passwordHash) {
    return jsonError("This account uses social login. Please log in via the website.", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return jsonError("Invalid email or password.", 401);
  }

  if (!user.emailVerified) {
    return jsonError("Please verify your email with the OTP sent during signup before logging in.", 403);
  }

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
