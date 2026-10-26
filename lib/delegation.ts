import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

export const DELEGATABLE_ROLES = new Set([
  "admin", "human-resource", "finance", "project-manager", "qa-tester",
  "it-admin", "it-administration", "warehouse", "security",
]);

type DelegableFeature = { key: string; name: string; actions: string[] };

const HR_FEATURES: DelegableFeature[] = [
  { key: "hr-policy-editing", name: "HR · Edit Policies", actions: ["View policies", "Edit policy", "Submit for approval"] },
  { key: "hr-member-management", name: "HR · Company Members", actions: ["View members", "Manage roles", "Manage memberships", "Submit for approval"] },
  { key: "hr-salary-management", name: "HR · Salary Management", actions: ["View salary records", "Prepare salary change", "Submit for approval"] },
  { key: "hr-export-excels", name: "HR · Export Reports", actions: ["Export member Excel", "Export HR report"] },
  { key: "hr-onboarding", name: "HR · Onboarding", actions: ["View onboarding", "Edit checklist", "Submit for approval"] },
  { key: "recruitment-create-jobs", name: "Recruitment · Create Jobs", actions: ["Draft job", "Edit job", "Submit for approval"] },
  { key: "recruitment-screening", name: "Recruitment · Candidate Screening", actions: ["View candidates", "Screen candidate", "Update stage", "Submit for approval"] },
  { key: "recruitment-offers", name: "Recruitment · Offer Letters", actions: ["Prepare offer", "Generate offer letter", "Submit for approval"] },
  { key: "recruitment-assessments", name: "Recruitment · Assessments", actions: ["Create assessment", "Manage assessment", "Review results", "Submit for approval"] },
  { key: "recruitment-interviews", name: "Recruitment · Interviews", actions: ["Schedule interview", "Manage interview", "Record feedback", "Submit for approval"] },
];

const FINANCE_FEATURES: DelegableFeature[] = [
  { key: "finance-policy-editing", name: "Finance · Edit Policies", actions: ["View policies", "Edit finance policy", "Submit for approval"] },
  { key: "finance-expense-requests", name: "Finance · Expense Requests", actions: ["View requests", "Prepare expense", "Attach evidence", "Submit for approval"] },
  { key: "finance-invoices", name: "Finance · Create Invoices", actions: ["Create invoice draft", "Edit invoice", "Submit for approval"] },
  { key: "finance-project-budgets", name: "Finance · Allocate Project Budget", actions: ["View budgets", "Prepare allocation", "Submit for approval"] },
  { key: "finance-salaries", name: "Finance · Generate Salaries", actions: ["Prepare salary run", "Review salary run", "Submit for approval"] },
  { key: "finance-attendance-export", name: "Finance · Export Attendance", actions: ["View attendance", "Export attendance Excel"] },
  { key: "finance-checkout-requests", name: "Finance · Check-out Requests", actions: ["View requests", "Review request", "Approve or reject"] },
];

const PROJECT_FEATURES: DelegableFeature[] = [
  { key: "project-management", name: "Projects · Project Management", actions: ["View projects", "Edit project", "Submit for approval"] },
  { key: "project-task-management", name: "Projects · Task Management", actions: ["Create task", "Assign task", "Update task", "Submit for approval"] },
  { key: "project-budget-planning", name: "Projects · Budget Planning", actions: ["View budget", "Prepare budget request", "Submit for approval"] },
  { key: "project-reports", name: "Projects · Export Reports", actions: ["View reports", "Export project Excel"] },
];

const QA_FEATURES: DelegableFeature[] = [
  { key: "qa-test-plans", name: "QA · Test Plans", actions: ["Create test plan", "Edit test plan", "Submit for approval"] },
  { key: "qa-assessment-review", name: "QA · Assessment Review", actions: ["Review assessment", "Record result", "Submit for approval"] },
  { key: "qa-defect-review", name: "QA · Defect Review", actions: ["View defects", "Update defect", "Submit for approval"] },
  { key: "qa-reports", name: "QA · Export Reports", actions: ["View QA reports", "Export QA Excel"] },
];

const IT_FEATURES: DelegableFeature[] = [
  { key: "it-tickets", name: "IT · Ticket Management", actions: ["View tickets", "Assign ticket", "Update ticket", "Submit for approval"] },
  { key: "it-provisioning", name: "IT · Provisioning", actions: ["Prepare request", "Create account request", "Submit for approval"] },
  { key: "it-joining-codes", name: "IT · Joining Codes", actions: ["View codes", "Create code", "Revoke code", "Submit for approval"] },
  { key: "it-team-management", name: "IT · Team Management", actions: ["View IT team", "Manage assignment", "Submit for approval"] },
];

const WAREHOUSE_FEATURES: DelegableFeature[] = [
  { key: "warehouse-inventory", name: "Store · Inventory Management", actions: ["View inventory", "Edit item", "Submit for approval"] },
  { key: "warehouse-stock-movements", name: "Store · Stock Movements", actions: ["Prepare stock movement", "Attach evidence", "Submit for approval"] },
  { key: "warehouse-orders", name: "Store · Order Management", actions: ["View orders", "Prepare order update", "Submit for approval"] },
  { key: "warehouse-delivery", name: "Store · Delivery Management", actions: ["View deliveries", "Update delivery", "Submit for approval"] },
  { key: "warehouse-reports", name: "Store · Export Reports", actions: ["View store reports", "Export inventory Excel"] },
];

const SECURITY_FEATURES: DelegableFeature[] = [
  { key: "security-visitors", name: "Security · Visitor Management", actions: ["View visitors", "Create visitor pass", "Submit for approval"] },
  { key: "security-entry-logs", name: "Security · Entry Logs", actions: ["View entry logs", "Export entry logs Excel"] },
  { key: "security-lost-cards", name: "Security · Lost Card Handling", actions: ["View reports", "Disable access", "Submit for approval"] },
  { key: "security-access-review", name: "Security · Access Review", actions: ["Review access", "Prepare access change", "Submit for approval"] },
];

// Visitor pass creation is shareable by every operational leader, not only
// security. Reuse the same `security-visitors` key so the existing visitor
// routes and delegated-recipient handling keep working unchanged.
const VISITOR_PASS_FEATURE: DelegableFeature = {
  key: "security-visitors",
  name: "Visitor Pass · Create Visitor Pass",
  actions: ["View visitors", "Create visitor pass", "Submit for approval"],
};

export const FEATURES_BY_ROLE: Record<string, DelegableFeature[]> = {
  "human-resource": [...HR_FEATURES, VISITOR_PASS_FEATURE],
  finance: [...FINANCE_FEATURES, VISITOR_PASS_FEATURE],
  "project-manager": [...PROJECT_FEATURES, VISITOR_PASS_FEATURE],
  "qa-tester": [...QA_FEATURES, VISITOR_PASS_FEATURE],
  "it-admin": [...IT_FEATURES, VISITOR_PASS_FEATURE],
  "it-administration": [...IT_FEATURES, VISITOR_PASS_FEATURE],
  warehouse: [...WAREHOUSE_FEATURES, VISITOR_PASS_FEATURE],
  security: SECURITY_FEATURES,
  admin: [...HR_FEATURES, ...FINANCE_FEATURES, ...PROJECT_FEATURES, ...QA_FEATURES, ...IT_FEATURES, ...WAREHOUSE_FEATURES, ...SECURITY_FEATURES],
};

export function featuresForRole(role: string, isSeniorSecurity = false) {
  if (String(role) === "security" && !isSeniorSecurity) return [];
  return FEATURES_BY_ROLE[String(role)] ?? [];
}
export function canDelegate(role: string, isSeniorSecurity = false) {
  if (String(role) === "security") return Boolean(isSeniorSecurity);
  return DELEGATABLE_ROLES.has(String(role));
}

export function generateDelegationPin() {
  let pin = "";
  for (let i = 0; i < 8; i++) pin += String(randomInt(0, 10));
  return pin;
}
export function pinHash(pin: string) { return bcrypt.hash(pin, 12); }
export function verifyPin(pin: string, hash: string) { return bcrypt.compare(pin, hash); }

function encryptionKey() {
  const secret = process.env.DELEGATION_PIN_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("DELEGATION_PIN_ENCRYPTION_KEY is required for delegation PIN recovery.");
  return createHash("sha256").update(secret).digest();
}

export function encryptDelegationPin(pin: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptDelegationPin(value: string) {
  const [ivRaw, tagRaw, cipherRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !cipherRaw) throw new Error("Invalid encrypted delegation PIN.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(cipherRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function sameCompany(a: unknown, b: unknown) { return Boolean(a && b && String(a) === String(b)); }
export function safePinShape(value: unknown): value is string { return typeof value === "string" && /^[0-9]{8}$/.test(value); }
export function constantTimeStringEqual(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
