import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { signMobileToken } from "@/lib/mobile-auth";
import { rateLimitLogin } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

function getClientIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "127.0.0.1";
}

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return jsonError("Email and password are required.");
  }

  const ip = getClientIp(request);
  const loginCheck = rateLimitLogin(ip, email);
  if (!loginCheck.success) {
    return NextResponse.json(
      {
        error: "Too many login attempts. Please try again later.",
        retryAfter: loginCheck.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(loginCheck.retryAfter),
        },
      }
    );
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
    await recordAudit({
      action: "auth.login.failed",
      actionLabel: "Sign-in attempt failed",
      company: null,
      result: "failed",
      metadata: { email, reason: "unknown_email" },
      request,
    });
    return jsonError("Invalid email or password.", 401);
  }

  if (!user.passwordHash) {
    await recordAudit({
      action: "auth.login.failed",
      actionLabel: "Sign-in attempt failed",
      company: user.company ?? null,
      actor: { id: user._id, name: user.name, email: user.email, role: user.role },
      result: "failed",
      metadata: { email, reason: "no_local_password" },
      request,
    });
    return jsonError("This account uses social login. Please log in via the website.", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await recordAudit({
      action: "auth.login.failed",
      actionLabel: "Sign-in attempt failed",
      company: user.company ?? null,
      actor: { id: user._id, name: user.name, email: user.email, role: user.role },
      result: "failed",
      metadata: { email, reason: "invalid_password" },
      request,
    });
    return jsonError("Invalid email or password.", 401);
  }

  if (!user.emailVerified) {
    await recordAudit({
      action: "auth.login.failed",
      actionLabel: "Sign-in attempt failed",
      company: user.company ?? null,
      actor: { id: user._id, name: user.name, email: user.email, role: user.role },
      result: "failed",
      metadata: { email, reason: "unverified_email" },
      request,
    });
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

  await recordAudit({
    action: "auth.login",
    actionLabel: "Member signed in",
    company: user.company ?? null,
    actor: { id: user._id, name: user.name, email: user.email, role: user.role },
    result: "success",
    metadata: { email: user.email, provider: "mobile" },
    request,
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
