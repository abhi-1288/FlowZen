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

  return {
    subject: `Interview Scheduled for ${jobTitle} (${roundType})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1e293b;">Interview Scheduled</h2>
        <p>Dear ${candidateName},</p>
        <p>Your interview for <strong>${jobTitle}</strong> has been scheduled.</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Round</td><td style="padding:4px 0;font-weight:600;">${roundType}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Date</td><td style="padding:4px 0;font-weight:600;">${dateStr}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Time</td><td style="padding:4px 0;font-weight:600;">${timeStr}</td></tr>
          ${meetingLink ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Meeting Link</td><td style="padding:4px 0;"><a href="${meetingLink}" style="color:#2563eb;">${meetingLink}</a></td></tr>` : ""}
        </table>
        <p style="color:#64748b;font-size:14px;">Please be prepared and join on time. Good luck!</p>
      </div>
    `,
  };
}

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

  return {
    subject: `Interview Rescheduled – ${jobTitle} (${roundType})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1e293b;">Interview Rescheduled</h2>
        <p>Dear ${candidateName},</p>
        <p>Your interview for <strong>${jobTitle}</strong> has been rescheduled.</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Round</td><td style="padding:4px 0;font-weight:600;">${roundType}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;">New Date</td><td style="padding:4px 0;font-weight:600;">${dateStr}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;">New Time</td><td style="padding:4px 0;font-weight:600;">${timeStr}</td></tr>
          ${meetingLink ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Meeting Link</td><td style="padding:4px 0;"><a href="${meetingLink}" style="color:#2563eb;">${meetingLink}</a></td></tr>` : ""}
        </table>
        <p style="color:#64748b;font-size:14px;">Please update your calendar accordingly. Apologies for any inconvenience.</p>
      </div>
    `,
  };
}

export function interviewCancelledEmail({
  candidateName,
  jobTitle,
  roundType,
}: {
  candidateName: string;
  jobTitle: string;
  roundType: string;
}) {
  return {
    subject: `Interview Cancelled – ${jobTitle} (${roundType})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#dc2626;">Interview Cancelled</h2>
        <p>Dear ${candidateName},</p>
        <p>Your interview for <strong>${jobTitle}</strong> (${roundType}) has been cancelled.</p>
        <p style="color:#64748b;font-size:14px;">We will reach out if the interview is rescheduled.</p>
      </div>
    `,
  };
}
