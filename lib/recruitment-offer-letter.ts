type OfferLetterCandidate = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

type OfferLetterJob = {
  department?: string;
};

type OfferLetterCompany = {
  name?: string;
  icon?: string;
};

type OfferLetterOffer = {
  offeredCTC?: number;
  salaryType?: "per-annum" | "per-month";
  pfAmount?: number;
  esicAmount?: number;
  joiningDate?: Date | string | null;
  designation?: string;
  department?: string;
  officeLocation?: string;
  perks?: string;
  status?: string;
};

type OfferLetterPolicy = {
  foodAmount?: number;
  travelAccommodationAmount?: number;
};

export type RecruitmentOfferLetterInput = {
  offer: OfferLetterOffer;
  candidate: OfferLetterCandidate;
  job?: OfferLetterJob | null;
  company: OfferLetterCompany;
  policy?: OfferLetterPolicy | null;
  title?: string;
  dispositionFilename?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number) {
  return `&#8377;${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", options ?? { day: "numeric", month: "long", year: "numeric" });
}

function renderCompanyMark(companyName: string, companyIcon: string) {
  if (companyIcon) {
    return `<img src="${escapeHtml(companyIcon)}" alt="" class="company-icon" />`;
  }

  return `<div class="company-fallback">${escapeHtml(companyName[0] || "C")}</div>`;
}

export function renderRecruitmentOfferLetterHtml(input: RecruitmentOfferLetterInput) {
  const { offer, candidate, job, company, policy } = input;
  const companyName = company.name || "Company";
  const companyIcon = company.icon || "";
  const candidateName = `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || "Candidate";
  const pfAmt = Number(offer.pfAmount || 0);
  const esicAmt = Number(offer.esicAmount || 0);
  const foodAmt = policy ? Number(policy.foodAmount || 0) * 12 : 0;
  const travelAmt = policy ? Number(policy.travelAccommodationAmount || 0) * 12 : 0;
  const offeredCTC = Number(offer.offeredCTC || 0);
  const netTakeHome = offeredCTC - pfAmt - esicAmt - foodAmt - travelAmt;
  const joiningDate = formatDate(offer.joiningDate);
  const generatedDate = formatDate(new Date());
  const compactGeneratedDate = formatDate(new Date(), { day: "numeric", month: "numeric", year: "numeric" });
  const status = String(offer.status || "");
  const isMonthlySalary = offer.salaryType === "per-month";
  const compensationPeriod = isMonthlySalary ? "Per Month" : "Per Annum";
  const amountPeriodLabel = isMonthlySalary ? "month" : "year";

  const detailsRows = [
    ["Candidate Name", candidateName],
    ["Email", candidate.email || ""],
    candidate.phone ? ["Phone", candidate.phone] : null,
    ["Designation", offer.designation || ""],
    ["Department", offer.department || job?.department || "N/A"],
    offer.officeLocation ? ["Office Location", offer.officeLocation] : null,
    joiningDate ? ["Joining Date", joiningDate] : null,
  ].filter(Boolean) as string[][];

  const compensationRows = [
    `<tr><td>Gross CTC</td><td class="amount strong">${formatCurrency(offeredCTC)}</td></tr>`,
    pfAmt > 0 ? `<tr><td>- PF Deduction</td><td class="amount deduction">- ${formatCurrency(pfAmt)}</td></tr>` : "",
    esicAmt > 0 ? `<tr><td>- ESIC Deduction</td><td class="amount deduction">- ${formatCurrency(esicAmt)}</td></tr>` : "",
    foodAmt > 0 ? `<tr><td>- Food Accommodation</td><td class="amount deduction">- ${formatCurrency(foodAmt)}</td></tr>` : "",
    travelAmt > 0 ? `<tr><td>- Travel Accommodation</td><td class="amount deduction">- ${formatCurrency(travelAmt)}</td></tr>` : "",
    `<tr class="net-row"><td>Net Take-Home (Approx)</td><td class="amount">${formatCurrency(netTakeHome)}</td></tr>`,
  ].join("");

  const statusBadge = status
    ? `<span class="status status-${escapeHtml(status)}">${escapeHtml(status)}</span>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.title || `Offer Letter - ${companyName}`)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #1e293b; background: #f1f5f9; line-height: 1.55; }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 24px; border-bottom: 1px solid #e2e8f0; background: #fff; }
    .toolbar h1 { margin: 0; border: 0; padding: 0; font-size: 18px; font-weight: 600; color: #0f172a; }
    .toolbar-actions { display: flex; align-items: center; gap: 12px; }
    .status { display: inline-flex; border-radius: 999px; padding: 4px 12px; font-size: 14px; font-weight: 600; text-transform: lowercase; background: #fef3c7; color: #92400e; }
    .status-sent, .status-accepted { background: #ecfdf5; color: #047857; }
    .status-rejected { background: #fff1f2; color: #be123c; }
    .toolbar button { border: 0; border-radius: 8px; background: #020617; color: #fff; padding: 9px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .toolbar button:hover { background: #1e293b; }
    .letter-page { width: min(210mm, calc(100% - 32px)); margin: 24px auto; padding: 40px; background: #fff; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12); }
    .letter-header { margin-bottom: 32px; text-align: center; }
    .company-line { display: flex; align-items: center; justify-content: center; gap: 12px; }
    .company-icon, .company-fallback { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
    .company-fallback { display: flex; align-items: center; justify-content: center; background: #0f172a; color: #fff; font-size: 14px; font-weight: 700; }
    .company-name { margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; color: #0f172a; }
    .header-rule { width: 80px; height: 2px; margin: 12px auto 0; background: #4f46e5; }
    .letter-title { margin: 0 0 24px; text-align: center; border: 0; padding: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
    p { margin: 0 0 16px; font-size: 14px; }
    .date-line { margin-bottom: 24px; color: #475569; }
    .body-copy { font-size: 14px; color: #1e293b; }
    .details-card { margin: 16px 0 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .details-card td { padding: 6px 16px 6px 0; }
    .details-card td:first-child { width: 34%; color: #64748b; }
    .details-card td:last-child { font-weight: 600; color: #0f172a; }
    .section-title { margin: 24px 0 12px; font-size: 14px; font-weight: 700; color: #0f172a; }
    .compensation { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 8px; }
    .compensation th, .compensation td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    .compensation th { background: #f1f5f9; color: #334155; font-weight: 700; }
    .compensation tr:last-child td { border-bottom: 0; }
    .amount { text-align: right !important; }
    .strong { font-weight: 600; color: #0f172a; }
    .deduction { color: #e11d48; }
    .net-row td { background: #ecfdf5; color: #065f46; font-weight: 700; }
    .perks { margin-top: 16px; border: 1px solid #fde68a; border-radius: 8px; background: #fffbeb; padding: 16px; color: #78350f; }
    .perks h4 { margin: 0 0 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; color: #92400e; }
    .perks p { margin: 0; color: #78350f; }
    .signatures { margin-top: 48px; }
    .signatures-label { margin-bottom: 32px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; color: #64748b; }
    .signature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 48px; row-gap: 40px; }
    .signature-block { display: flex; flex-direction: column; align-items: center; }
    .signature-role { margin: 0 0 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; color: #94a3b8; }
    .signature-line { width: 192px; height: 40px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; }
    .signature-company { margin: 0; font-size: 14px; font-weight: 600; color: #0f172a; }
    .footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .letter-page { width: 100%; min-height: 100vh; margin: 0 auto; padding: 24px; box-shadow: none; font-size: 11px; }
      .letter-header { margin-bottom: 16px; }
      .company-name { font-size: 20px; }
      .header-rule { margin-top: 4px; }
      .letter-title { margin-bottom: 16px; font-size: 18px; }
      p, table, .body-copy { font-size: 11px; }
      .date-line { margin-bottom: 16px; }
      .details-card { padding: 8px; }
      .details-card td { padding: 4px 8px 4px 0; }
      .section-title { margin: 16px 0 8px; }
      .compensation th, .compensation td { padding: 4px 8px; }
      .perks { margin-top: 8px; padding: 8px; }
      .perks h4, .signatures-label, .signature-role { font-size: 10px; }
      .signatures { margin-top: 24px; }
      .signatures-label { margin-bottom: 16px; }
      .signature-grid { column-gap: 24px; row-gap: 12px; }
      .signature-line { width: 144px; height: 24px; }
      .signature-company { font-size: 11px; }
      .footer { margin-top: 24px; padding-top: 8px; font-size: 9px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Offer Letter</h1>
    <div class="toolbar-actions">
      ${statusBadge}
      <button onclick="window.print()">Download PDF</button>
    </div>
  </div>
  <main class="letter-page">
    <header class="letter-header">
      <div class="company-line">
        ${renderCompanyMark(companyName, companyIcon)}
        <h2 class="company-name">${escapeHtml(companyName)}</h2>
      </div>
      <div class="header-rule"></div>
    </header>

    <h1 class="letter-title">Offer of Employment</h1>
    <p class="date-line">Date: <strong>${escapeHtml(generatedDate)}</strong></p>

    <section class="body-copy">
      <p>Dear <strong>${escapeHtml(candidateName)}</strong>,</p>
      <p>We are pleased to offer you the position of <strong>${escapeHtml(offer.designation || "")}</strong> at <strong>${escapeHtml(companyName)}</strong>. We were impressed with your qualifications and believe your skills and experience will be a valuable addition to our team.</p>

      <div class="details-card">
        <table>
          <tbody>
            ${detailsRows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>

      <h3 class="section-title">Compensation Summary (${compensationPeriod})</h3>
      <div class="compensation">
        <table>
          <thead>
            <tr><th>Component</th><th class="amount">Amount (&#8377;/${amountPeriodLabel})</th></tr>
          </thead>
          <tbody>${compensationRows}</tbody>
        </table>
      </div>

      ${offer.perks ? `<div class="perks"><h4>Travel &amp; Food Accommodation</h4><p>${escapeHtml(offer.perks)}</p></div>` : ""}

      <p style="margin-top:16px;">We look forward to welcoming you to ${escapeHtml(companyName)} and are excited about the contributions you will make to our team.</p>
    </section>

    <section class="signatures">
      <p class="signatures-label">Authorized Signatories</p>
      <div class="signature-grid">
        <div class="signature-block">
          <p class="signature-role">Authorized Signatory</p>
          <div class="signature-line"></div>
          <p class="signature-company">${escapeHtml(companyName)}</p>
        </div>
      </div>
    </section>

    <footer class="footer">Generated by FlowZen &middot; ${escapeHtml(compactGeneratedDate)}</footer>
  </main>
</body>
</html>`;
}
