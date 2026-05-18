import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { sendMail } from "@/lib/mailer";

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = ["employee", "project-manager", "qa-tester", "admin", "others"].includes(String(body.role))
    ? String(body.role)
    : "employee";

  if (!name || !email || password.length < 8) {
    return jsonError("Name, email, and an 8+ character password are required.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const existing = await User.findOne({ email }).select("+otpHash +otpExpiresAt");
  if (existing?.emailVerified) return jsonError("An account with this email already exists.", 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(otp, 12);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const user = existing
    ? await User.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            name,
            email,
            passwordHash,
            role,
            emailVerified: false,
            otpHash,
            otpExpiresAt,
            authProvider: "credentials"
          }
        },
        { new: true }
      )
    : await User.create({
        name,
        email,
        passwordHash,
        role,
        emailVerified: false,
        otpHash,
        otpExpiresAt,
        authProvider: "credentials"
      });

  try {
    await sendMail({
      to: email,
      subject: "Your FlowZen OTP",
      text: `Your FlowZen verification code is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your FlowZen verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to send OTP email.", 500);
  }

  return NextResponse.json({
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    message: "OTP sent to your email."
  });
}
