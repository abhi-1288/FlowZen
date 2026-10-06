import type { NextAuthOptions } from "next-auth";
import type { AppUserRole } from "@/types/next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import AppleProvider from "next-auth/providers/apple";
import GitHubProvider from "next-auth/providers/github";
import DiscordProvider from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { connectDb } from "@/lib/db";
import { canRunRecruitmentPipeline } from "@/lib/recruitment-hq";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { rateLimitLogin } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

const oauthProviders = [
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        })
      ]
    : []),
  ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
    ? [
        AzureADProvider({
          clientId: process.env.AZURE_AD_CLIENT_ID,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
          tenantId: process.env.AZURE_AD_TENANT_ID || "common"
        })
      ]
    : []),
  ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
    ? [
        AppleProvider({
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET
        })
      ]
    : []),
  ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
    ? [
        GitHubProvider({
          clientId: process.env.GITHUB_ID,
          clientSecret: process.env.GITHUB_SECRET
        })
      ]
    : []),
  ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
    ? [
        DiscordProvider({
          clientId: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET
        })
      ]
    : [])
];

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 365 * 24 * 60 * 60
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth-error"
  },
  providers: [
    CredentialsProvider({
      id: "credentials-login",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "text" }
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        const headersRecord = (req as any)?.headers as Record<string, string | undefined> | undefined;
        const auditRequest = { headers: headersRecord ?? {} } as unknown as Request;
        const logLogin = (
          result: "success" | "failed",
          metadata: Record<string, unknown>,
          user?: any,
        ) =>
          recordAudit({
            action: result === "success" ? "auth.login" : "auth.login.failed",
            actionLabel:
              result === "success" ? "Member signed in" : "Sign-in attempt failed",
            company: user?.company ?? null,
            actor: user
              ? { id: user._id, name: user.name, email: user.email, role: user.role }
              : null,
            result,
            metadata,
            request: auditRequest,
          });

        if (!email || !password) {
          await logLogin("failed", { email: email || "", reason: "missing_credentials" });
          return null;
        }

        const headers =
          typeof headersRecord === "object" && headersRecord
            ? headersRecord
            : undefined;
        const ip =
          headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
          headers?.["x-real-ip"]?.trim() ||
          "127.0.0.1";

        const loginCheck = rateLimitLogin(ip, email);
        if (!loginCheck.success) {
          await logLogin("failed", { email, reason: "rate_limited" });
          throw new Error("Too many login attempts. Please try again later.");
        }

        await connectDb();
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user) {
          await logLogin("failed", { email, reason: "unknown_email" });
          return null;
        }
        if (!user.passwordHash) {
          await logLogin("failed", { email, reason: "no_local_password" }, user);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await logLogin("failed", { email, reason: "invalid_password" }, user);
          return null;
        }
        if (!user.emailVerified) {
          await logLogin("failed", { email, reason: "unverified_email" }, user);
          throw new Error("Please verify your email with the OTP sent during signup before logging in.");
        }

        await logLogin("success", { email }, user);

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          rememberMe: credentials?.rememberMe === "true"
        };
      }
    }),
    CredentialsProvider({
      id: "forgot-password-magic",
      name: "Forgot password magic link",
      credentials: {
        token: { label: "Token", type: "text" }
      },
      async authorize(credentials) {
        const token = String(credentials?.token ?? "");
        if (!token) return null;

        await connectDb();
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: { $gt: new Date() }
        }).select("+passwordResetTokenHash +passwordResetExpiresAt");

        if (!user) return null;
        if (user.authProvider !== "credentials") return null;

        user.passwordResetTokenHash = undefined;
        user.passwordResetExpiresAt = null;
        user.passwordResetRequired = true;
        user.emailVerified = true;
        await user.save();

        await recordAudit({
          action: "auth.password.reset",
          actionLabel: "Password reset link used",
          company: user.company ?? null,
          actor: { id: user._id, name: user.name, email: user.email, role: user.role },
          result: "success",
        });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          passwordResetRequired: true
        };
      }
    }),
    ...oauthProviders
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (
        !account ||
        account.provider === "credentials-login" ||
        account.provider === "forgot-password-magic"
      ) {
        return true;
      }
      if (!user.email) return false;

      await connectDb();
      const provider = account.provider === "azure-ad" ? "microsoft" : account.provider;
      let existing = await User.findOne({ email: user.email.toLowerCase() });

      // Auto-delete unverified OAuth accounts older than 15 days
      if (
        existing &&
        existing.role === "others" &&
        !existing.emailVerified &&
        existing.authProvider !== "credentials" &&
        existing.createdAt < new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      ) {
        await User.deleteOne({ _id: existing._id });
        existing = null;
      }

      const savedUser = existing
        ? await User.findOneAndUpdate(
            { _id: existing._id },
            {
              $set: {
                name: user.name || existing.name,
                authProvider: provider,
                avatarUrl: user.image || existing.avatarUrl || ""
              }
            },
            { new: true }
          )
        : await User.create({
            name: user.name || user.email.split("@")[0],
            email: user.email.toLowerCase(),
            role: "others",
            emailVerified: false,
            authProvider: provider,
            avatarUrl: user.image || ""
          });

      if (!savedUser) return false;
      user.id = savedUser._id.toString();
      user.role = savedUser.role;
      await recordAudit({
        action: "auth.login",
        actionLabel: "Member signed in",
        company: (savedUser as any).company ?? null,
        actor: {
          id: savedUser._id,
          name: savedUser.name,
          email: savedUser.email,
          role: savedUser.role,
        },
        result: "success",
        metadata: { provider: account.provider === "azure-ad" ? "microsoft" : account.provider },
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (user?.role) (token as any).role = user.role;
      if ((user as any)?.passwordResetRequired) token.passwordResetRequired = true;
      if (typeof (user as any)?.rememberMe === "boolean") token.rememberMe = (user as any).rememberMe;

      // Periodically refresh user data from the database (every 15 min).
      // This caches company, team, and role in the token so the session
      // callback can read them without a DB query on every request.
      if (token.sub) {
        const lastCheck = (token as any)._userCheckAt as number | undefined;
        const now = Date.now();
        if (!lastCheck || now - lastCheck > 15 * 60 * 1000) {
          try {
            await connectDb();
            const userDoc = await User.findById(token.sub)
              .populate("company", "name primaryColor slug owner addresses address")
              .populate("team", "name");
            if (!userDoc) return null!;
            (token as any).role = userDoc.role;
            (token as any).isSeniorSecurity = Boolean((userDoc as any).isSeniorSecurity);
            const team = userDoc.team as any;
            const companyDoc = userDoc.company as any;
            // Company owners get a few powers their role string does not imply
            // (e.g. routing candidates between regions) because the owner's
            // role can be anything. Cached on the same 15-min cycle as the rest.
            (token as any).isCompanyOwner = Boolean(
              companyDoc?.owner && String(companyDoc.owner) === String(userDoc._id),
            );
            // Whether this user runs the recruitment pipeline: raises requisitions
            // for any location and runs ATS / assessment / interviews company-wide.
            // Held on the token so the client can hide controls it cannot use,
            // rather than rendering a button that 403s on submit. The same decision
            // is re-derived from the database on every server route that enforces
            // it, so a stale token can only cause a wrong button, never a bypass.
            (token as any).isRecruitmentHQ = canRunRecruitmentPipeline(
              {
                owner: companyDoc?.owner,
                addresses: companyDoc?.addresses,
                address: companyDoc?.address,
              } as any,
              {
                _id: userDoc._id,
                role: userDoc.role,
                regionLabel: (userDoc as any).regionLabel,
                company: userDoc.company,
              } as any,
            );
            (token as any).company = companyDoc?.name || null;
            (token as any).companyColor = companyDoc?.primaryColor || "#2563eb";
            (token as any).team = team?.name || null;
            (token as any).teamId = team?._id ? String(team._id) : (typeof userDoc.team === "string" ? userDoc.team : null);
            (token as any).managedTeamCount = await Team.countDocuments({ manager: userDoc._id });
            (token as any)._userCheckAt = now;
          } catch {
            // DB unreachable – keep the session alive
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token || !token.sub) {
        if (session) session.expires = new Date(0).toISOString();
        return session;
      }
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role as AppUserRole | undefined;
        session.user.passwordResetRequired = Boolean(token.passwordResetRequired);
        if (typeof token.rememberMe !== "undefined") session.user.rememberMe = token.rememberMe;

        // Read cached data from token — no DB query on every request
        session.user.company = (token as any).company || null;
        session.user.companyColor = (token as any).companyColor || null;
        session.user.team = (token as any).team || null;
        session.user.teamId = (token as any).teamId || null;
        session.user.managedTeamCount = (token as any).managedTeamCount || 0;
        session.user.isSeniorSecurity = Boolean((token as any).isSeniorSecurity);
        session.user.isCompanyOwner = Boolean((token as any).isCompanyOwner);
        session.user.isRecruitmentHQ = Boolean((token as any).isRecruitmentHQ);
      }
      return session;
    }
  }
};
