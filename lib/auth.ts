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
    strategy: "jwt"
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
        password: { label: "Password", type: "password" }
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
          role: user.role
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
      const existing = await User.findOne({ email: user.email.toLowerCase() });

      if (existing && existing.role !== "project-manager" && existing.role !== "qa-tester" && existing.role !== "human-resource" && existing.role !== "finance") {
        return false;
      }

      const savedUser = existing
        ? await User.findOneAndUpdate(
            { _id: existing._id },
            {
              $set: {
                name: user.name || existing.name,
                emailVerified: true,
                authProvider: provider,
                avatarUrl: user.image || existing.avatarUrl || ""
              }
            },
            { new: true }
          )
        : await User.create({
            name: user.name || user.email.split("@")[0],
            email: user.email.toLowerCase(),
            role: "project-manager",
            emailVerified: true,
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
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role as "employee" | "project-manager" | "qa-tester" | "human-resource" | "finance" | "admin" | "others" | undefined;
        session.user.passwordResetRequired = Boolean(token.passwordResetRequired);
        
        try {
          await connectDb();
          const user = await User.findById(token.sub).populate("company", "name").populate("team", "name");
          if (user) {
            const team = user.team as any;
            session.user.company = (user.company as any)?.name || null;
            session.user.team = team?.name || null;
            session.user.teamId = team?._id ? String(team._id) : (typeof user.team === "string" ? user.team : null);
          }
        } catch (error) {
          console.error("Failed to fetch company/team in session:", error);
        }
      }
      return session;
    }
  }
};
