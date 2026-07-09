// ── Shared helpers ──────────────────────────────────────────

function baseEmailLayout(content: string, options: { title?: string; companyName?: string } = {}): string {
  const brand = options.companyName || "FlowZen";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || ""}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1e293b;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${brand}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; ${year} ${brand}. All rights reserved.</p>
              <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">This is an automated message. Please do not reply directly.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailButton(link: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr>
      <td align="center" style="background:#10b981;border-radius:8px;">
        <a href="${link}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${text}</a>
      </td>
    </tr>
  </table>`;
}

// ── OTP / Verification ──────────────────────────────────────

type OtpPurpose = "registration" | "login" | "email-change" | "account-verification";

const otpPurposeLabels: Record<OtpPurpose, { title: string; description: string }> = {
  registration: {
    title: "Verify Your Email",
    description: "Use the verification code below to complete your FlowZen registration.",
  },
  login: {
    title: "Secure Login Code",
    description: "Use the verification code below to continue signing in to FlowZen.",
  },
  "email-change": {
    title: "Confirm Email Change",
    description: "Use the verification code below to confirm your new email address on FlowZen.",
  },
  "account-verification": {
    title: "Verify Your Account",
    description: "Use the verification code below to complete your FlowZen account setup.",
  },
};

export function otpEmailContent(otp: string, purpose: OtpPurpose, userName?: string): { subject: string; text: string; html: string } {
  const { title, description } = otpPurposeLabels[purpose];
  const greeting = userName ? `Hello ${userName},` : "Hello,";

  const subjectMap: Record<OtpPurpose, string> = {
    registration: "Verify your FlowZen email",
    login: "Your FlowZen login code",
    "email-change": "Confirm your new email",
    "account-verification": "Verify your FlowZen account",
  };

  const html = baseEmailLayout(`
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">${title}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">${description}</p>

    <p style="margin:0 0 24px;font-size:15px;color:#334155;">${greeting}</p>

    <div style="margin:0 0 24px;text-align:center;background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;padding:24px;">
      <p style="margin:0 0 6px;font-size:12px;color:#059669;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Verification Code</p>
      <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:#059669;font-family:'Courier New',monospace;">${otp}</p>
    </div>

    <p style="margin:0 0 4px;font-size:13px;color:#64748b;">This code expires in <strong>10 minutes</strong>.</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">If you didn't request this code, you can safely ignore this email.</p>
  `, { title: subjectMap[purpose] });

  const textSubjectMap: Record<OtpPurpose, string> = {
    registration: "Your FlowZen OTP",
    login: "Your FlowZen OTP",
    "email-change": "Your FlowZen Email Change OTP",
    "account-verification": "Your FlowZen OTP",
  };

  return {
    subject: subjectMap[purpose],
    text: `${textSubjectMap[purpose]}\n\n${greeting}\n\nUse this code to verify: ${otp}\n\nThis code expires in 10 minutes.`,
    html,
  };
}

// ── Password Reset ───────────────────────────────────────────

export function passwordResetEmailContent(magicLink: string): { subject: string; text: string; html: string } {
  const html = baseEmailLayout(`
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">Reset Your Password</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">We received a request to reset your FlowZen password.</p>

    <p style="margin:0 0 8px;font-size:15px;color:#334155;">Hello,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Click the button below to securely sign in and update your password. This link is valid for <strong>15 minutes</strong>.</p>

    ${emailButton(magicLink, "Reset Your Password")}

    <p style="margin:0 0 4px;font-size:13px;color:#64748b;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin:0 0 24px;font-size:12px;color:#64748b;word-break:break-all;">${magicLink}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:8px;padding:16px;width:100%;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0;font-size:13px;color:#dc2626;font-weight:600;">Didn't request this?</p>
          <p style="margin:4px 0 0;font-size:13px;color:#64748b;">If you didn't request a password reset, please ignore this email. Your account remains secure.</p>
        </td>
      </tr>
    </table>
  `, { title: "Reset Your Password" });

  return {
    subject: "Reset your FlowZen password",
    text: `Reset Your Password\n\nUse this link to reset your password: ${magicLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
    html,
  };
}

// ── Application Received ─────────────────────────────────────

export function applicationReceivedContent(firstName: string, jobTitle: string, portalLink: string): { subject: string; text: string; html: string } {
  const html = baseEmailLayout(`
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">Application Received</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">Thank you for applying.</p>

    <p style="margin:0 0 8px;font-size:15px;color:#334155;">Hi <strong>${firstName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">We've received your application for <strong>${jobTitle}</strong>. Our team will review it and get back to you.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Position</p>
          <p style="margin:0;font-size:16px;font-weight:600;color:#1e293b;">${jobTitle}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:14px;color:#334155;">You can track your application status anytime:</p>

    ${emailButton(portalLink, "Track Your Application")}

    <p style="margin:0;font-size:12px;color:#94a3b8;">Or open this link: <a href="${portalLink}" style="color:#10b981;text-decoration:underline;">${portalLink}</a></p>
  `, { title: "Application Received" });

  return {
    subject: `Application received for ${jobTitle}`,
    text: `Hi ${firstName},\n\nThank you for applying to ${jobTitle}.\n\nTrack your application: ${portalLink}`,
    html,
  };
}

// ── Interview Scheduled ──────────────────────────────────────

export function interviewScheduledEmail({
  candidateName,
  jobTitle,
  roundType,
  scheduledAt,
  meetingLink,
}: {
  candidateName: string;
  jobTitle: string;
  roundType: string;
  scheduledAt: Date;
  meetingLink?: string;
}) {
  const dateStr = scheduledAt.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const timeStr = scheduledAt.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  const html = baseEmailLayout(`
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">Interview Scheduled</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">${roundType} round for ${jobTitle}</p>

    <p style="margin:0 0 8px;font-size:15px;color:#334155;">Dear ${candidateName},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#334155;">Your interview for <strong>${jobTitle}</strong> has been scheduled.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:4px 16px;width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Round</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${roundType}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Date</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${dateStr}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Time</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${timeStr}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${meetingLink ? emailButton(meetingLink, "Join Meeting") : ""}

    <p style="margin:0;font-size:14px;color:#64748b;">Please be prepared and join on time. Good luck!</p>
  `, { title: "Interview Scheduled" });

  return {
    subject: `Interview Scheduled for ${jobTitle} (${roundType})`,
    text: `Dear ${candidateName},\n\nYour interview for ${jobTitle} (${roundType}) has been scheduled.\n\nDate: ${dateStr}\nTime: ${timeStr}${meetingLink ? `\nMeeting: ${meetingLink}` : ""}`,
    html,
  };
}

// ── Interview Rescheduled ────────────────────────────────────

export function interviewRescheduledEmail({
  candidateName,
  jobTitle,
  roundType,
  scheduledAt,
  meetingLink,
}: {
  candidateName: string;
  jobTitle: string;
  roundType: string;
  scheduledAt: Date;
  meetingLink?: string;
}) {
  const dateStr = scheduledAt.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const timeStr = scheduledAt.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  const html = baseEmailLayout(`
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">Interview Rescheduled</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#d97706;">${roundType} round for ${jobTitle}</p>

    <p style="margin:0 0 8px;font-size:15px;color:#334155;">Dear ${candidateName},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#334155;">Your interview for <strong>${jobTitle}</strong> has been rescheduled to a new date.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:4px 16px;width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Round</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${roundType}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:100px;">New Date</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${dateStr}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:100px;">New Time</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${timeStr}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${meetingLink ? emailButton(meetingLink, "Join Meeting") : ""}

    <p style="margin:0;font-size:14px;color:#64748b;">Please update your calendar accordingly. Apologies for any inconvenience.</p>
  `, { title: "Interview Rescheduled" });

  return {
    subject: `Interview Rescheduled – ${jobTitle} (${roundType})`,
    text: `Dear ${candidateName},\n\nYour interview for ${jobTitle} (${roundType}) has been rescheduled.\n\nNew Date: ${dateStr}\nNew Time: ${timeStr}${meetingLink ? `\nMeeting: ${meetingLink}` : ""}`,
    html,
  };
}

// ── Interview Cancelled ──────────────────────────────────────

export function interviewCancelledEmail({
  candidateName,
  jobTitle,
  roundType,
}: {
  candidateName: string;
  jobTitle: string;
  roundType: string;
}) {
  const html = baseEmailLayout(`
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#dc2626;">Interview Cancelled</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">${roundType} round for ${jobTitle}</p>

    <p style="margin:0 0 8px;font-size:15px;color:#334155;">Dear ${candidateName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Your interview for <strong>${jobTitle}</strong> (${roundType}) has been <strong style="color:#dc2626;">cancelled</strong>.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0;font-size:14px;color:#dc2626;">We will reach out if the interview is rescheduled.</p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#64748b;">We apologise for any inconvenience caused.</p>
  `, { title: "Interview Cancelled" });

  return {
    subject: `Interview Cancelled – ${jobTitle} (${roundType})`,
    text: `Dear ${candidateName},\n\nYour interview for ${jobTitle} (${roundType}) has been cancelled.\n\nWe will reach out if the interview is rescheduled.`,
    html,
  };
}

// ── Offer Letter ─────────────────────────────────────────────

export function offerLetterContent({
  candidateName,
  designation,
  offeredCTC,
  department,
  joiningDate,
}: {
  candidateName: string;
  designation: string;
  offeredCTC: number;
  department?: string;
  joiningDate?: Date | null;
}): { subject: string; text: string; html: string } {
  const html = baseEmailLayout(`
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">Offer Letter</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">Congratulations on your offer!</p>

    <p style="margin:0 0 8px;font-size:15px;color:#334155;">Dear <strong>${candidateName}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#334155;">We are pleased to offer you the position of <strong>${designation}</strong>. Below are the key details:</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:4px 16px;width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:120px;">Designation</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${designation}</td>
            </tr>
          </table>
        </td>
      </tr>
      ${department ? `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:120px;">Department</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${department}</td>
            </tr>
          </table>
        </td>
      </tr>
      ` : ""}
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:120px;">Offered CTC</td>
              <td style="font-size:15px;font-weight:600;color:#059669;">&#8377;${offeredCTC.toLocaleString()}<span style="font-size:13px;color:#64748b;font-weight:400;">/year</span></td>
            </tr>
          </table>
        </td>
      </tr>
      ${joiningDate ? `
      <tr>
        <td style="padding:12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:120px;">Joining Date</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;">${new Date(joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</td>
            </tr>
          </table>
        </td>
      </tr>
      ` : ""}
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Please log in to the candidate portal using the link from your application email to view and accept your offer letter.</p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">This is a system-generated offer letter. For any queries, please contact the HR team.</p>
  `, { title: "Offer Letter" });

  return {
    subject: `Offer Letter - ${designation} position`,
    text: `Dear ${candidateName},\n\nWe are pleased to offer you the position of ${designation}.\n\nOffered CTC: ₹${offeredCTC.toLocaleString()}/year\n\nPlease log in to the candidate portal to view and accept your offer letter.`,
    html,
  };
}

// ── Employee Account Created ─────────────────────────────────

export function employeeAccountContent({
  firstName,
  companyName,
  email,
  password,
  loginUrl,
}: {
  firstName: string;
  companyName: string;
  email: string;
  password: string;
  loginUrl: string;
}): { subject: string; text: string; html: string } {
  const html = baseEmailLayout(`
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">Welcome to ${companyName}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">Your employee account has been created.</p>

    <p style="margin:0 0 8px;font-size:15px;color:#334155;">Dear ${firstName},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#334155;">Your employee account at <strong>${companyName}</strong> has been created successfully. You can now access the platform with the credentials below.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:4px 16px;width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:100px;vertical-align:top;padding:4px 0;">Email</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;padding:4px 0;">${email}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:100px;vertical-align:top;padding:4px 0;">Password</td>
              <td style="font-size:15px;font-weight:600;color:#1e293b;font-family:'Courier New',monospace;padding:4px 0;">${password}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${emailButton(loginUrl, "Sign In to Your Account")}

    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;width:100%;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0;font-size:13px;color:#92400e;font-style:italic;">For security reasons, we recommend changing your password after your first login.</p>
        </td>
      </tr>
    </table>
  `, { title: "Welcome Aboard", companyName });

  return {
    subject: `Your Employee Account at ${companyName}`,
    text: `Dear ${firstName},\n\nYour employee account at ${companyName} has been created.\n\nEmail: ${email}\nPassword: ${password}\n\nSign in: ${loginUrl}\n\nPlease change your password after first login.`,
    html,
  };
}

// ── Visitor Pass / Temporary ID Card ─────────────────────────

export function visitorPassIdCardContent({
  pass,
  companyName,
  verifyUrl,
  qrSrc,
}: {
  pass: Record<string, unknown>;
  companyName: string;
  verifyUrl: string;
  qrSrc: string;
}): { subject: string; text: string; html: string } {
  const region = pass.region ? String(pass.region) : "Main Office";
  const hostName = pass.hostName ? String(pass.hostName) : "—";
  const visitorCompany = pass.visitorCompany ? String(pass.visitorCompany) : "—";
  const purpose = pass.purpose ? String(pass.purpose) : "—";

  const validFromStr = pass.validFrom
    ? new Date(String(pass.validFrom)).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "N/A";
  const validUntilStr = pass.validUntil
    ? new Date(String(pass.validUntil)).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "N/A";

  const signedBy = pass.signedBy ? String(pass.signedBy) : null;
  const signedRole = pass.signedRole ? String(pass.signedRole) : null;
  const signedAt = pass.signedAt
    ? new Date(String(pass.signedAt)).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Temporary ID Card</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Front Card Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px 24px 16px;text-align:center;">
              <h2 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${companyName}</h2>
              <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">Visitor ID Card</p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding:0;">
              <span style="display:inline-block;margin-top:-10px;background:#d97706;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 20px;border-radius:0 0 8px 8px;">Visitor</span>
            </td>
          </tr>

          <!-- Visitor Details -->
          <tr>
            <td style="padding:4px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ["Pass ID", String(pass.identityCode), "monospace"],
                  ["Name", String(pass.visitorName)],
                  ["Phone", pass.visitorPhone ? String(pass.visitorPhone) : "—"],
                  ["Email", String(pass.visitorEmail)],
                  ["Region", region],
                ].map(([label, value, font]) => `
                <tr>
                  <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;width:110px;padding:2px 0;">${label}</td>
                        <td style="font-size:13px;font-weight:600;color:#0f172a;padding:2px 0;${font === "monospace" ? "font-family:'Courier New',monospace;" : ""}">${value}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `).join("")}
              </table>
            </td>
          </tr>

          <!-- Validity -->
          <tr>
            <td style="padding:12px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:10px 14px;text-align:center;">
                    <p style="margin:0 0 2px;font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Valid From (±15 min)</p>
                    <p style="margin:0;font-size:12px;font-weight:600;color:#0f172a;">${validFromStr}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:10px 14px;text-align:center;">
                    <p style="margin:0 0 2px;font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Valid Until (±15 min)</p>
                    <p style="margin:0;font-size:12px;font-weight:600;color:#d97706;">${validUntilStr}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Code -->
          <tr>
            <td style="text-align:center;padding:16px 24px;">
              <img src="${qrSrc}" alt="QR Code" width="140" style="display:block;margin:0 auto;border-radius:8px;border:1px solid #e2e8f0;" />
              <p style="margin:6px 0 0;font-size:10px;color:#94a3b8;">Scan to verify your pass</p>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="border-top:1px solid #e2e8f0;margin:0 24px;padding:0 24px;text-align:center;">
              ${signedBy ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:16px 0 12px;text-align:center;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;font-family:'Georgia',serif;">${signedBy}</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#64748b;">${signedRole}</p>
                    <p style="margin:2px 0 0;font-size:10px;color:#94a3b8;">Signed on ${signedAt}</p>
                  </td>
                </tr>
              </table>
              ` : `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:16px 0 12px;text-align:center;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#cbd5e1;font-family:'Georgia',serif;">Authorised</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#cbd5e1;">Authorised Signature</p>
                  </td>
                </tr>
              </table>
              `}
            </td>
          </tr>

          <!-- Back Card -->
          <tr>
            <td style="border-top:2px dashed #e2e8f0;margin:0 24px;padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                ${[
                  ["Purpose", purpose],
                  ["Host", hostName],
                  ["Company", visitorCompany],
                  ["Visiting Office", region],
                ].map(([label, value]) => `
                <tr>
                  <td style="padding:5px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;width:110px;padding:2px 0;">${label}</td>
                        <td style="font-size:12px;font-weight:500;color:#334155;padding:2px 0;">${value}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `).join("")}
              </table>
            </td>
          </tr>

          <!-- Footer Note -->
          <tr>
            <td style="padding:16px 24px 12px;text-align:center;font-size:11px;color:#94a3b8;line-height:1.5;">
              Please present this QR code or Pass ID at the security gate upon arrival.<br>
              Entry may be permitted 15 minutes before or after the scheduled time.
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:14px 24px;text-align:center;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
              ${companyName} &middot; Security Team
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `Your Temporary ID Card – ${companyName}`,
    text: `Your temporary visitor pass for ${companyName} has been approved.\n\nPass ID: ${pass.identityCode}\nName: ${pass.visitorName}\nRegion: ${region}\nValid From: ${validFromStr}\nValid Until: ${validUntilStr}\nHost: ${hostName}\n\nPlease present this Pass ID or QR code at the security gate upon arrival.\n\n${companyName} Security Team`,
    html,
  };
}
