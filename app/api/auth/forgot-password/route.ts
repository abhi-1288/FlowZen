import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { createMagicLinkToken } from "@/lib/codes";
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

  const token = createMagicLinkToken();
  user.passwordResetTokenHash = createHash("sha256").update(token).digest("hex");
  user.passwordResetExpiresAt = new Date(Date.now() + 1000 * 60 * 15);
  await user.save();

  const origin =
    process.env.NODE_ENV === "development"
      ? new URL(request.url).origin
      : process.env.NEXT_PUBLIC_APP_URL ||
        new URL(request.url).origin ||
        process.env.NEXTAUTH_URL;
  const magicLink = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendMail({
      to: email,
      subject: "Your FlowZen password reset link",
      text: `Use this secure link to sign in and update your password: ${magicLink}\n\nThis link expires in 15 minutes. If you did not request it, you can ignore this email.`,
      html: `<p>Use this secure link to sign in and update your password:</p><p><a href="${magicLink}">Sign in to update password</a></p><p>This link expires in 15 minutes. If you did not request it, you can ignore this email.</p>`
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to send password reset email.", 500);
  }

  return NextResponse.json({
    ok: true,
    message: "Password reset link sent to your email."
  });
}
