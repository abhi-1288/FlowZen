import { User } from "@/models/User";
import { sendMail } from "@/lib/mailer";
import { baseEmailLayout, emailButton } from "@/lib/email-templates";
import { effectiveRegionLabelOf } from "@/lib/company-regions";

export type PolicyChangeKind = "weekend" | "wfh" | "check-in";

export type PolicyDetail = { label: string; value: string };

export type PolicyChangeEmailInput = {
  company: {
    _id?: unknown;
    name?: string | null;
    icon?: string | null;
    addresses?: unknown[] | null;
    address?: string | null;
  };
  actor: {
    _id?: unknown;
    id?: unknown;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  kind: PolicyChangeKind;
  /** Empty or omitted means company-wide, which emails every member. */
  region?: string | null;
  title: string;
  summary: string;
  details?: PolicyDetail[];
  reason?: string | null;
};

type EmailMember = {
  _id?: unknown;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  regionLabel?: string | null;
};

const MANAGER_ROLES = new Set(["admin", "human-resource"]);

const ACCENTS: Record<PolicyChangeKind, { accent: string; soft: string; badge: string }> = {
  weekend: { accent: "#4f46e5", soft: "#eef2ff", badge: "Weekend policy" },
  wfh: { accent: "#0d9488", soft: "#f0fdfa", badge: "WFH policy" },
  "check-in": { accent: "#d97706", soft: "#fffbeb", badge: "Attendance policy" },
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roleLabel(role: unknown): string {
  const raw = String(role ?? "").trim();
  if (!raw) return "Team member";
  if (raw === "human-resource") return "HR";
  if (raw === "admin") return "Admin";
  if (raw === "project-manager") return "Project Manager";
  if (raw === "finance") return "Finance";
  if (raw === "it-admin" || raw === "it-administration") return "IT Admin";
  if (raw === "qa-tester") return "QA Tester";
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, " ");
}

function extractEmail(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return (match ? match[1] : value).trim().toLowerCase();
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).trim().toLowerCase() : "";
}

function senderFor(actorEmail: string, actorName: string): { from?: string; replyTo?: string } {
  const configured = String(process.env.SMTP_FROM ?? "").trim();
  if (!actorEmail) return { from: configured || undefined };

  const configuredEmail = extractEmail(configured);
  // Only send "from" the actor when the SMTP account is allowed to use that
  // domain. Otherwise keep the verified sender and route replies to the actor.
  const sameDomain =
    Boolean(configuredEmail) && emailDomain(configuredEmail) === emailDomain(actorEmail);
  if (sameDomain) {
    const display = actorName ? `"${actorName.replace(/"/g, "")}" ` : "";
    return { from: `${display}<${actorEmail}>`, replyTo: actorEmail };
  }
  return { from: configured || undefined, replyTo: actorEmail };
}

function formatDetailRows(details: PolicyDetail[]): string {
  if (!details.length) return "";
  const rows = details
    .map(
      (detail) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;white-space:nowrap;vertical-align:top;">${escapeHtml(detail.label)}</td>
        <td style="padding:10px 0 10px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(detail.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:collapse;">${rows}</table>`;
}

export function buildPolicyChangeEmail(input: PolicyChangeEmailInput) {
  const companyName = String(input.company?.name ?? "Your company").trim() || "Your company";
  const actorName = String(input.actor?.name ?? "A company administrator").trim() || "A company administrator";
  const actorRole = roleLabel(input.actor?.role);
  const accent = ACCENTS[input.kind];
  const regionLabel = String(input.region ?? "").trim() || "All offices";
  const reason = String(input.reason ?? "").trim();

  const subject = `${companyName}: ${input.title}`;

  const content = `
    <div style="display:inline-block;background:${accent.soft};color:${accent.accent};font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;padding:6px 12px;border-radius:999px;">${escapeHtml(accent.badge)}</div>
    <h2 style="margin:16px 0 6px;font-size:21px;line-height:1.3;font-weight:700;color:#1e293b;">${escapeHtml(input.title)}</h2>
    <p style="margin:0 0 22px;font-size:14px;color:#64748b;">${escapeHtml(companyName)} &middot; ${escapeHtml(regionLabel)}</p>

    <p style="margin:0 0 8px;font-size:15px;color:#334155;">Hello,</p>
    <p style="margin:0 0 22px;font-size:15px;color:#334155;">
      <strong>${escapeHtml(actorName)}</strong> (${escapeHtml(actorRole)}) has just updated a company policy.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${accent.accent};border-radius:10px;padding:18px 20px;margin:0 0 20px;">
      <p style="margin:0;font-size:15px;font-weight:600;color:#1e293b;">${escapeHtml(input.summary)}</p>
      ${formatDetailRows(input.details ?? [])}
    </div>

    ${
      reason
        ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin:0 0 20px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#b45309;">Reason</p>
            <p style="margin:0;font-size:14px;color:#78350f;">${escapeHtml(reason)}</p>
          </div>`
        : ""
    }

    <p style="margin:0 0 4px;font-size:14px;color:#475569;">
      This change is already live in your Attendance and Company Calendar. No action is needed from you.
    </p>
    ${emailButton(
      `${(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "")}/profile/attendance`,
      "Open Attendance",
    )}

    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      You are receiving this because you are a member of ${escapeHtml(companyName)}.
    </p>
  `;

  const html = baseEmailLayout(content, {
    title: subject,
    companyName,
    companyLogo: input.company?.icon || "",
  });

  const detailText = (input.details ?? [])
    .map((detail) => `${detail.label}: ${detail.value}`)
    .join("\n");
  const text = [
    `${input.title} — ${companyName} (${regionLabel})`,
    "",
    "Hello,",
    `${actorName} (${actorRole}) has just updated a company policy.`,
    "",
    input.summary,
    detailText,
    reason ? `Reason: ${reason}` : "",
    "",
    "This change is already live in your Attendance and Company Calendar.",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

async function resolveRecipients(input: PolicyChangeEmailInput) {
  const members = (await User.find({
    company: input.company._id,
    companyStatus: "approved",
  })
    .select("name email role regionLabel")
    .lean()) as unknown as EmailMember[];

  const targetRegion = String(input.region ?? "").trim().toLowerCase();
  const actorEmail = String(input.actor?.email ?? "").trim().toLowerCase();

  const to = new Set<string>();
  const cc = new Set<string>();

  for (const member of members) {
    const email = String(member.email ?? "").trim().toLowerCase();
    if (!email) continue;

    const isManager = MANAGER_ROLES.has(String(member.role ?? ""));
    const memberRegion = effectiveRegionLabelOf(input.company as any, member).toLowerCase();
    const inRegion = !targetRegion || memberRegion === targetRegion;

    // "To" is the audience the policy applies to; "CC" keeps every admin and
    // HR in the loop even when the change is scoped to a single office.
    if (inRegion) to.add(email);
    if (isManager) cc.add(email);
  }

  // Never email the person who made the change.
  if (actorEmail) {
    to.delete(actorEmail);
    cc.delete(actorEmail);
  }
  // A manager in the target region should not appear twice.
  for (const email of to) cc.delete(email);

  return { to: Array.from(to), cc: Array.from(cc) };
}

/**
 * Emails a policy change to the people it affects. Region-scoped changes go to
 * that region's members; company-wide changes go to everyone. Admins and HR are
 * always CC'd. Delivery failures are logged, never surfaced to the caller.
 */
export async function sendPolicyChangeEmail(input: PolicyChangeEmailInput) {
  try {
    const { to, cc } = await resolveRecipients(input);
    if (!to.length && !cc.length) return { sent: false, to: 0, cc: 0 };

    const actorEmail = String(input.actor?.email ?? "").trim().toLowerCase();
    const sender = senderFor(actorEmail, String(input.actor?.name ?? "").trim());
    const body = buildPolicyChangeEmail(input);

    await sendMail({
      to,
      cc,
      from: sender.from,
      replyTo: sender.replyTo,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });

    return { sent: true, to: to.length, cc: cc.length };
  } catch (error) {
    console.error(
      "[policy-email] failed to send policy change email:",
      error instanceof Error ? error.message : error,
    );
    return { sent: false, to: 0, cc: 0 };
  }
}
