import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { sendMail } from "@/lib/mailer";

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const role = [
    "employee",
    "project-manager",
    "qa-tester",
    "admin",
    "others",
  ].includes(String(body.role))
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

  const existing = await User.findOne({ email }).select(
    "+otpHash +otpExpiresAt",
  );
  if (existing?.emailVerified)
    return jsonError("An account with this email already exists.", 409);

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
            authProvider: "credentials",
          },
        },
        { new: true },
      )
    : await User.create({
        name,
        email,
        passwordHash,
        role,
        emailVerified: false,
        otpHash,
        otpExpiresAt,
        authProvider: "credentials",
      });

  try {
    await sendMail({
      to: email,
      subject: "Your FlowZen OTP",
      text: ` FlowZen Verification
      
      Hello,

    Use the verification code below to continue signing in to FlowZen:

    ${otp}

    This code will expire in 10 minutes.

    If you didn’t request this code, you can safely ignore this email.

    — Team FlowZen`,
      html: `<div style="background:linear-gradient(135deg,#10b981,#059669); padding:32px; text-align:center;"> <h1 style="margin:0; color:white; font-size:28px;">🌿 FlowZen</h1> <p style="margin-top:8px; color:#d1fae5; font-size:14px;"> Secure Verification Code </p> </div> <div style="padding:36px 32px;"> <p style="font-size:16px; margin-bottom:18px;"> Hello, </p> <p style="font-size:15px; line-height:1.7; color:#4b5563;"> Use the verification code below to continue your FlowZen login. </p> <div style=" margin:32px 0; text-align:center; background:#ecfdf5; border:2px dashed #10b981; border-radius:14px; padding:22px; "> <div style=" font-size:36px; font-weight:700; letter-spacing:8px; color:#059669; "> ${otp} </div> </div> <p style="font-size:14px; color:#6b7280; line-height:1.6;"> ⏳ This code expires in <strong>10 minutes</strong>. </p> <p style="font-size:14px; color:#6b7280; line-height:1.6;"> If you didn’t request this verification code, you can safely ignore this email. </p> </div> <div style=" background:#f9fafb; padding:18px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; "> © 2026 FlowZen • Secure Authentication System </div>`,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to send OTP email.",
      500,
    );
  }

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    message: "OTP sent to your email.",
  });
}
