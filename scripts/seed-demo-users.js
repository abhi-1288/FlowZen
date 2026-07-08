const bcrypt = require("bcryptjs");
const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");

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

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ["employee", "project-manager", "qa-tester", "human-resource", "finance", "admin", "security", "others"],
      default: "employee",
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date, default: null, select: false },
    passwordResetRequired: { type: Boolean, default: false },
    authProvider: {
      type: String,
      enum: ["credentials", "google", "microsoft", "apple", "github", "discord"],
      default: "credentials",
    },
  },
  { timestamps: true, strict: false },
);

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadLocalEnv();

  const uri = process.env.NODE_ENV === "production" ? process.env.ATLAS_URI : process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
  });

  const User = mongoose.models.User || mongoose.model("User", UserSchema);

  for (const demoUser of demoUsers) {
    const password = `${demoUser.email.split("@")[0]}@flowzen`;
    const passwordHash = await bcrypt.hash(password, 12);

    await User.updateOne(
      { email: demoUser.email },
      {
        $set: {
          ...demoUser,
          passwordHash,
          emailVerified: true,
          otpHash: undefined,
          otpExpiresAt: null,
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

    console.log(`Seeded ${demoUser.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
