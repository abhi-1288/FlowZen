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
  { name: "FlowZen IT Admin Manager", email: "it_admin@flowzen.com", role: "it-admin" },
  { name: "FlowZen IT Support Professional", email: "it_support@flowzen.com", role: "it-administration" },
];

const ITTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, default: "OTHER" },
    priority: { type: String, default: "MEDIUM" },
    status: { type: String, default: "PENDING" },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: String, default: "" },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: null },
    resolution: { type: String, default: "" },
    resolutionType: { type: String, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    employeeConfirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
    cancelReason: { type: String, default: "" },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    comments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    attachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    activity: { type: [mongoose.Schema.Types.Mixed], default: [] },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  },
  { timestamps: true, strict: false },
);

const DEMO_TICKETS = [
  { title: "Cannot log into email account", description: "Login page returns 'invalid credentials' for the last two days.", category: "EMAIL", priority: "HIGH", status: "PENDING" },
  { title: "Laptop not booting after update", description: "System update interrupted and now the laptop hangs on the logo screen.", category: "HARDWARE", priority: "URGENT", status: "PENDING" },
  { title: "Need access to Finance shared folder", description: "New join needs read/write access to the Finance portal share.", category: "ACCESS_PERMISSION", priority: "MEDIUM", status: "ASSIGNED" },
  { title: "Software installation request", description: "Install the latest diagramming tool for documentation work.", category: "SOFTWARE", priority: "MEDIUM", status: "QUEUED" },
  { title: "Wi-Fi keeps dropping", description: "Connection drops every few minutes on the 5GHz network.", category: "NETWORK", priority: "HIGH", status: "IN_PROGRESS" },
  { title: "Printer not printing in color", description: "Office printer outputs black and white only despite color cartridges present.", category: "PRINTER_PERIPHERAL", priority: "LOW", status: "WAITING_FOR_USER" },
  { title: "Reset password for CRM", description: "Forgot password for the CRM application and cannot reset via portal.", category: "ACCOUNT_LOGIN", priority: "HIGH", status: "AWAITING_CONFIRMATION" },
  { title: "Monitor flickering issue", description: "External monitor flickers intermittently throughout the day.", category: "HARDWARE", priority: "LOW", status: "RESOLVED" },
];

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ["employee", "project-manager", "qa-tester", "human-resource", "finance", "admin", "security", "it-admin", "it-administration", "others"],
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

  // ── Optional: seed demo IT tickets ────────────────────────────────────
  // Only runs when a real demo company exists (admin approved). Requests are
  // authored by the seeded employee, assigned to the seeded IT staff/admin.
  try {
    const Company = mongoose.models.Company;
    const User = mongoose.models.User || mongoose.model("User", UserSchema);
    const ITTicket = mongoose.models.ITTicket || mongoose.model("ITTicket", ITTicketSchema);

    const demoCompany = Company
      ? await Company.findOne({ "admins.email": "admin@flowzen.com" })
      : null;

    if (!demoCompany) {
      console.log("No demo company found; skipping demo IT tickets.");
    } else {
      const requester = await User.findOne({ email: "employee@flowzen.com" });
      const itAdmin = await User.findOne({ email: "it_admin@flowzen.com" });
      const itSupport = await User.findOne({ email: "it_support@flowzen.com" });
      if (!requester || !itAdmin || !itSupport) {
        console.log("Missing IT demo users; skipping demo IT tickets.");
      } else {
        const bank = {
          requester: requester._id,
          manager: requester._id,
          itAdmin: itAdmin._id,
          itSupport: itSupport._id,
          company: demoCompany._id,
        };
        const existing = await ITTicket.countDocuments({ ticketNumber: /^IT-100\d$/ });
        if (existing >= DEMO_TICKETS.length) {
          console.log("Demo IT tickets already present; skipping.");
        } else {
          const now = Date.now();
          await ITTicket.create(
            DEMO_TICKETS.map((t, i) => {
              const doc = {
                ticketNumber: `IT-${1001 + i}`,
                title: t.title,
                description: t.description,
                category: t.category,
                priority: t.priority,
                status: t.status,
                requester: bank.requester,
                department: "Engineering",
                manager: bank.manager,
                company: bank.company,
                activity: [],
              };
              if (["ASSIGNED", "QUEUED", "IN_PROGRESS", "WAITING_FOR_USER", "AWAITING_CONFIRMATION", "RESOLVED"].includes(t.status)) {
                doc.assignedTo = t.priority === "URGENT" || t.status === "IN_PROGRESS" ? bank.itSupport : bank.itAdmin;
                doc.assignedBy = bank.itAdmin;
                doc.assignedAt = new Date(now - 2 * 864e5);
                doc.activity.push({
                  user: bank.itAdmin,
                  action: "Assigned",
                  detail: `Assigned to ${t.priority === "URGENT" || t.status === "IN_PROGRESS" ? "IT Support" : "IT Admin"}`,
                  createdAt: doc.assignedAt,
                });
              }
              if (t.status === "RESOLVED") {
                doc.resolution = "Replaced the monitor cable and restarted the display adapter.";
                doc.resolutionType = "HARDWARE_REPAIRED";
                doc.resolvedBy = bank.itAdmin;
                doc.resolvedAt = new Date(now - 1 * 864e5);
                doc.employeeConfirmed = true;
                doc.confirmedAt = doc.resolvedAt;
                doc.activity.push({ user: bank.itAdmin, action: "Resolved", detail: "Replaced monitor cable", createdAt: doc.resolvedAt });
              }
              doc.activity.push({ user: bank.requester, action: "Created", detail: t.title, createdAt: new Date(now - 3 * 864e5) });
              return doc;
            }),
          );
          console.log(`Seeded ${DEMO_TICKETS.length} demo IT tickets.`);
        }
      }
    }
  } catch (err) {
    console.log("Skipped demo IT tickets:", err && err.message ? err.message : err);
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
