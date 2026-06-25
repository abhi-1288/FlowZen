import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import AppleProvider from "next-auth/providers/apple";
import GitHubProvider from "next-auth/providers/github";
import DiscordProvider from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Team } from "@/models/Team";

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
  pages: {
    signIn: "/login"
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
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        await connectDb();
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user) return null;
        if (!user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        if (!user.emailVerified) {
          throw new Error("Please verify your email with the OTP sent during signup before logging in.");
        }

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
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (user?.role) token.role = user.role;
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
              .populate("company", "name")
              .populate("team", "name");
            if (!userDoc) return null!;
            token.role = userDoc.role;
            const team = userDoc.team as any;
            (token as any).company = (userDoc.company as any)?.name || null;
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
        session.user.role = token.role as "employee" | "project-manager" | "qa-tester" | "human-resource" | "finance" | "admin" | "others" | undefined;
        session.user.passwordResetRequired = Boolean(token.passwordResetRequired);
        if (typeof token.rememberMe !== "undefined") session.user.rememberMe = token.rememberMe;

        // Read cached data from token — no DB query on every request
        session.user.company = (token as any).company || null;
        session.user.team = (token as any).team || null;
        session.user.teamId = (token as any).teamId || null;
        session.user.managedTeamCount = (token as any).managedTeamCount || 0;
      }
      return session;
    }
  }
};
