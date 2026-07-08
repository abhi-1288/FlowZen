import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

const demoUsers = [
  { name: "FlowZen Admin", email: "admin@flowzen.com", role: "admin" },
  { name: "FlowZen Manager", email: "manager@flowzen.com", role: "project-manager" },
  { name: "FlowZen HR", email: "hr@flowzen.com", role: "human-resource" },
  { name: "FlowZen Tester", email: "tester@flowzen.com", role: "qa-tester" },
  { name: "FlowZen Employee", email: "employee@flowzen.com", role: "employee" },
  { name: "FlowZen Finance", email: "finance@flowzen.com", role: "finance" },
  { name: "FlowZen Sr. Security", email: "s_security@flowzen.com", role: "security", isSeniorSecurity: true },
  { name: "FlowZen Jr. Security", email: "j_security@flowzen.com", role: "security" },
  { name: "FlowZen Other", email: "other@flowzen.com", role: "others" },
];

export async function POST() {
  try {
    await connectDb();

    let seeded = 0;
    for (const user of demoUsers) {
      const password = `${user.email.split("@")[0]}@flowzen`;
      const passwordHash = await bcrypt.hash(password, 12);

      await User.updateOne(
        { email: user.email },
        {
          $set: {
            ...user,
            passwordHash,
            emailVerified: true,
            passwordResetRequired: false,
            authProvider: "credentials",
          },
          $setOnInsert: {
            companyStatus: "none",
            teamStatus: "none",
            avatarUrl: "",
            customRole: "",
            baseSalary: 0,
          },
        },
        { upsert: true },
      );
      seeded++;
    }

    return NextResponse.json({ success: true, seeded });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: "Failed to seed demo users" }, { status: 500 });
  }
}
