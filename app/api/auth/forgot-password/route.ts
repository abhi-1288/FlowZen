import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { createTemporaryPassword } from "@/lib/codes";
import { sendMail } from "@/lib/mailer";
import { User } from "@/models/User";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return jsonError("Email is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) return jsonError("No account exists for this email.", 404);
  if (user.authProvider !== "credentials") return jsonError("This account uses an external auth provider.", 400);

  const temporaryPassword = createTemporaryPassword();
  user.passwordHash = await bcrypt.hash(temporaryPassword, 12);
  user.emailVerified = true;
  await user.save();

  try {
    await sendMail({
      to: email,
      subject: "Your FlowZen temporary password",
      text: `Your temporary password is ${temporaryPassword}. Sign in and update it from your profile.`,
      html: `<p>Your temporary password is <strong>${temporaryPassword}</strong>.</p><p>Sign in and update it from your profile.</p>`
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to send temporary password email.", 500);
  }

  return NextResponse.json({
    ok: true,
    message: "Temporary password sent to your email."
  });
}
