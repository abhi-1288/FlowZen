import nodemailer from "nodemailer";

type MailOptions = {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  /** Optional sender override. Falls back to SMTP_FROM. */
  from?: string;
  /** Where replies should go, typically the person who triggered the email. */
  replyTo?: string;
};

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

function joinAddresses(value: string | string[] | undefined): string {
  if (!value) return "";
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export async function sendMail(options: MailOptions) {
  if (!hasSmtpConfig()) {
    throw new Error("SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM to .env.local.");
  }

  const to = joinAddresses(options.to);
  if (!to) throw new Error("At least one recipient is required.");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const cc = joinAddresses(options.cc);

  await transporter.sendMail({
    from: options.from || process.env.SMTP_FROM,
    to,
    ...(cc ? { cc } : {}),
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    subject: options.subject,
    text: options.text,
    html: options.html
  });

  return { sent: true };
}
