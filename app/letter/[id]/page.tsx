"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";

type LetterData = {
  _id: string;
  id: string;
  kind: string;
  status: string;
  metadata: {
    letterType: string;
    customType?: string;
    purpose: string;
    approvedAt?: string;
    requesterName?: string;
    requesterRole?: string;
    internshipStart?: string;
    internshipEnd?: string;
    projectTitle?: string;
    projectDescription?: string;
    projectAchievements?: string;
    teamName?: string;
    teamManagerName?: string;
    teamManagerRole?: string;
    resignationLastWorkingDay?: string;
    noticePeriodDays?: number;
    letterContent?: string;
    isSigned?: boolean;
    signedBy?: string;
    signedRole?: string;
    signedAt?: string;
  };
  requester: {
    _id: string;
    name: string;
    email: string;
    role: string;
    companyIdentityCode?: string;
    companyJoined?: string;
    employmentEndDate?: string;
    baseSalary?: number;
    pfNumber?: string;
    pfDeductionAmount?: number;
    esicNumber?: string;
    esicDeductionAmount?: number;
    pfExempted?: boolean;
    esicExempted?: boolean;
    tdsExempted?: boolean;
  };
  approver?: { _id: string; name: string; role: string };
  company: { _id: string; name: string; icon?: string };
  createdAt: string;
};

type SalaryInfo = {
  baseSalary: number;
  netSalary: number;
};

type PolicyInfo = {
  foodAmount: number;
  travelAccommodationAmount: number;
  foodOptedOutMembers?: { _id?: string }[];
  travelOptedOutMembers?: { _id?: string }[];
  pfPercentage?: number;
  esicPercentage?: number;
  tdsPercentage?: number;
};

type LetterSigner = {
  name: string;
  role: string;
  signedAt?: string;
};

const SIGNATURE_FONT = "'Segoe Script', 'Dancing Script', cursive";

function formatRole(role: string) {
  const labels: Record<string, string> = {
    "human-resource": "Human Resource",
    "project-manager": "Project Manager",
    "qa-tester": "Q-A Tester",
    finance: "Finance",
    employee: "Employee",
    admin: "Admin",
    others: "Others",
  };
  return labels[role] ?? role;
}

const LETTER_TITLES: Record<string, string> = {
  experience: "Experience Certificate",
  "salary-certificate": "Salary Certificate",
  "offer-letter": "Offer Letter",
  relieving: "Relieving Letter",
  internship: "Internship Certificate",
  resignation: "Resignation Letter",
  "final-settlement": "Final Settlement Letter",
  "form-16": "Form 16",
  noc: "NOC Paper",
  "exit-agreement": "Exit Agreement",
  "employee-recognition": "Employee Recognition Letter",
  other: "Certificate",
};

function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

type LetterBodyVars = {
  name: string;
  role: string;
  companyName: string;
  joinDate: string;
  date: string;
  purpose: string;
  customType: string;
};

function buildLetterParagraphs(v: LetterBodyVars): Record<string, string> {
  const { name, role, companyName, joinDate, date, purpose, customType } = v;
  return {
    experience: `This is to certify that <strong>${name}</strong> has been employed with <strong>${companyName}</strong> in the capacity of <strong>${role}</strong> from ${joinDate} to date. During this period, they have demonstrated professionalism, dedication, and strong performance in their role.`,
    "offer-letter": `We are pleased to offer <strong>${name}</strong> the position of <strong>${role}</strong> at <strong>${companyName}</strong>. We look forward to a successful association.`,
    relieving: `This is to confirm that <strong>${name}</strong>, who served as <strong>${role}</strong> at <strong>${companyName}</strong> since ${joinDate}, has been relieved from their duties effective ${date}. They have completed all pending assignments and clearance formalities.`,
    other: customType
      ? `This is to certify that <strong>${name}</strong> has been associated with <strong>${companyName}</strong> as a <strong>${role}</strong>. Purpose: ${purpose}.`
      : "",
    "final-settlement": `This is to confirm that the full and final settlement of all dues for <strong>${name}</strong>, who served as <strong>${role}</strong> at <strong>${companyName}</strong> since ${joinDate}, has been processed and cleared as of ${date}. All pending settlements, dues, and statutory obligations have been accounted for and discharged.`,
    "form-16": `This is to certify that <strong>${name}</strong>, who served as <strong>${role}</strong> at <strong>${companyName}</strong>, has been issued Form 16 for the relevant financial year. This document summarizes the salary paid and the tax deducted at source (TDS) during the period of employment.`,
    noc: `This is to certify that <strong>${name}</strong>, who served as <strong>${role}</strong> at <strong>${companyName}</strong> since ${joinDate}, has no outstanding dues, obligations, or legal liabilities toward the company. <strong>${companyName}</strong> has no objection to any future endeavours undertaken by the employee.`,
    "exit-agreement": `This Exit Agreement is entered into between <strong>${companyName}</strong> and <strong>${name}</strong>, who served as <strong>${role}</strong> since ${joinDate}. Both parties hereby acknowledge that the employment has been concluded effective ${date}, all dues have been settled, and each party releases the other from any further claims, obligations, or liabilities arising from the employment.`,
  };
}

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || "";
  }
  return html.replace(/<[^>]+>/g, "");
}

function isOptedOut(members: { _id?: string }[] | undefined, userId: string): boolean {
  if (!members || members.length === 0) return false;
  return members.some((m) => String(m._id ?? "") === userId);
}

function LetterSignature({
  signer,
  className = "",
}: {
  signer: LetterSigner | null;
  className?: string;
}) {
  if (signer && signer.name) {
    const signedDate = signer.signedAt
      ? new Date(signer.signedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
    return (
      <div className={`mt-10 print:mt-4 ${className}`}>
        <p className="mb-6 text-[10px] font-semibold uppercase tracking-widest text-slate-400 print:mb-2">
          Authorized Signatory
        </p>
        <p
          className="mb-1 text-2xl leading-none text-slate-700 print:text-xl"
          style={{ fontFamily: SIGNATURE_FONT }}
        >
          {signer.name}
        </p>
        <p className="text-xs capitalize text-slate-500">
          {signer.role ? signer.role.replace(/-/g, " ") : ""}
        </p>
        {signedDate ? (
          <p className="mt-1 text-[10px] text-slate-400">Signed on {signedDate}</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className={`mt-10 print:mt-4 ${className}`}>
      <p className="mb-6 text-[10px] font-semibold uppercase tracking-widest text-slate-400 print:mb-2">
        Authorized Signatory
      </p>
      <div className="mb-2 h-10 w-48 border-b border-slate-400 print:h-6 print:w-36" />
      <p className="text-xs capitalize text-slate-400">Human Resource</p>
    </div>
  );
}

function InternshipCertificateContent({
  data, signer,
}: {
  data: LetterData; signer: LetterSigner | null;
}) {
  const name = data.metadata?.requesterName ?? data.requester?.name ?? "Employee";
  const role = data.metadata?.requesterRole ?? data.requester?.role ?? "Member";
  const companyName = data.company?.name ?? "Company";
  const purpose = data.metadata?.purpose ?? "";
  const start = data.metadata?.internshipStart ?? "";
  const end = data.metadata?.internshipEnd ?? "";
  const projectTitle = data.metadata?.projectTitle ?? "";
  const projectDescription = data.metadata?.projectDescription ?? "";
  const projectAchievements = data.metadata?.projectAchievements ?? "";
  const teamName = data.metadata?.teamName ?? "";
  const teamManagerName = data.metadata?.teamManagerName ?? "";
  const identityCode = data.requester?.companyIdentityCode;

  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5 text-sm leading-relaxed text-slate-800 print:space-y-2">
      <p>Date: <strong>{date}</strong></p>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:p-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 print:mb-1">Intern Details</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4 text-slate-500 print:py-0.5">Name</td>
              <td className="py-1 font-medium text-slate-900 print:py-0.5">{name}</td>
            </tr>
            {identityCode ? (
              <tr>
                <td className="py-1 pr-4 text-slate-500">Unique Identity</td>
                <td className="py-1 font-medium text-slate-900">{identityCode}</td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 pr-4 text-slate-500">Designation</td>
              <td className="py-1 font-medium text-slate-900 capitalize">{role}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-slate-500">Company</td>
              <td className="py-1 font-medium text-slate-900">{companyName}</td>
            </tr>
            {teamName ? (
              <tr><td className="py-1 pr-4 text-slate-500 print:py-0.5">Team</td><td className="py-1 font-medium text-slate-900 print:py-0.5">{teamName}</td></tr>
            ) : null}
            {teamManagerName ? (
              <tr><td className="py-1 pr-4 text-slate-500 print:py-0.5">Team Head</td><td className="py-1 font-medium text-slate-900 print:py-0.5">{teamManagerName} <span className="text-xs text-slate-500 capitalize print:text-[9px]">({formatRole(data.metadata?.teamManagerRole ?? "")})</span></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p>This is to certify that <strong>{name}</strong> has completed their internship at <strong>{companyName}</strong> as a <strong>{role}</strong>.</p>

      {start && end ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 print:p-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Internship Period</p>
          <p className="mt-1 font-medium text-slate-900">{formatDate(start)} — {formatDate(end)}</p>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:p-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 print:mb-1">Project</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4 text-slate-500 align-top print:py-0.5">Title</td>
              <td className="py-1 font-medium text-slate-900 print:py-0.5">{projectTitle || "—"}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-slate-500 align-top">Description</td>
              <td className="py-1 text-slate-700 whitespace-pre-wrap">{projectDescription || "—"}</td>
            </tr>
            {projectAchievements ? (
              <tr>
                <td className="py-1 pr-4 text-slate-500 align-top">Achievements</td>
                <td className="py-1 text-slate-700 whitespace-pre-wrap">{projectAchievements}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {purpose ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 print:p-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purpose</p>
          <p className="mt-1 text-slate-700">{purpose}</p>
        </div>
      ) : null}

      <LetterSignature signer={signer} />
    </div>
  );
}

function EmployeeRecognitionContent({
  data, signer,
}: {
  data: LetterData; signer: LetterSigner | null;
}) {
  const name = data.metadata?.requesterName ?? data.requester?.name ?? "Employee";
  const role = data.metadata?.requesterRole ?? data.requester?.role ?? "Member";
  const companyName = data.company?.name ?? "Company";
  const purpose = data.metadata?.purpose ?? "";
  const identityCode = data.requester?.companyIdentityCode;

  const startRaw = data.requester?.companyJoined ?? data.createdAt ?? "";
  const endRaw = data.requester?.employmentEndDate ?? "";

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const startDate = startRaw ? formatDate(startRaw) : "";
  const endDate = endRaw ? formatDate(endRaw) : "Present";

  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-5 text-sm leading-relaxed text-slate-800 print:space-y-2">
      <p>Date: <strong>{date}</strong></p>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:p-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 print:mb-1">Employee Details</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4 text-slate-500 print:py-0.5 align-top">Name</td>
              <td className="py-1 font-medium text-slate-900 print:py-0.5">{name}</td>
            </tr>
            {identityCode ? (
              <tr>
                <td className="py-1 pr-4 text-slate-500 align-top">Unique Identity</td>
                <td className="py-1 font-medium text-slate-900">{identityCode}</td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 pr-4 text-slate-500 align-top">Designation</td>
              <td className="py-1 font-medium text-slate-900 capitalize">{role}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-slate-500 align-top">Company</td>
              <td className="py-1 font-medium text-slate-900">{companyName}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-slate-500 align-top">Employment Period</td>
              <td className="py-1 font-medium text-slate-900">{startDate || "—"} — {endDate}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        This is to recognize that <strong>{name}</strong> has been working with <strong>{companyName}</strong> in the
        capacity of <strong>{role}</strong> from <strong>{startDate || "—"}</strong>{" "}
        to <strong>{endDate}</strong>.
        {endDate === "Present" ? " During this period, they continue to remain a valued member of the organization." : ""}
      </p>

      <p>
        Throughout their tenure, they have demonstrated exceptional dedication, professionalism, and commitment,
        contributing meaningfully to the growth and success of the organization. Their efforts and positive spirit
        have earned them the appreciation and recognition of the management and their peers.
      </p>

      {purpose ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 print:p-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purpose</p>
          <p className="mt-1 text-slate-700">{purpose}</p>
        </div>
      ) : null}

      <p className="text-xs text-slate-500 print:text-[9px]">
        This recognition is issued upon request and verified by the company.
      </p>

      <LetterSignature signer={signer} />
    </div>
  );
}

function SalaryCertificateContent({
  data,
  salary,
  policy,
  signer,
}: {
  data: LetterData;
  salary: SalaryInfo | null;
  policy: PolicyInfo | null;
  signer: LetterSigner | null;
}) {
  const name = data.metadata?.requesterName ?? data.requester?.name ?? "Employee";
  const role = data.metadata?.requesterRole ?? data.requester?.role ?? "Member";
  const companyName = data.company?.name ?? "Company";
  const purpose = data.metadata?.purpose ?? "";
  const requesterId = data.requester?._id ?? "";
  const identityCode = data.requester?.companyIdentityCode;

  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const monthlyBase = salary?.baseSalary ?? 0;
  const annualCtc = monthlyBase * 12;

  const foodDeduction = policy && !isOptedOut(policy.foodOptedOutMembers, requesterId) ? policy.foodAmount : 0;
  const travelDeduction = policy && !isOptedOut(policy.travelOptedOutMembers, requesterId) ? policy.travelAccommodationAmount : 0;

  const pfPct = policy?.pfPercentage ?? 12;
  const esicPct = policy?.esicPercentage ?? 0.75;
  const tdsPct = policy?.tdsPercentage ?? 0;
  const empPfAmount = Number(data.requester?.pfDeductionAmount ?? 0);
  const empEsicAmount = Number(data.requester?.esicDeductionAmount ?? 0);
  const pfDeduction = !data.requester?.pfExempted
    ? (empPfAmount > 0 ? empPfAmount : Math.round(monthlyBase * pfPct / 100))
    : 0;
  const esicDeduction = !data.requester?.esicExempted
    ? (empEsicAmount > 0 ? empEsicAmount : Math.round(monthlyBase * esicPct / 100))
    : 0;
  const tdsDeduction = !data.requester?.tdsExempted && tdsPct > 0
    ? Math.round(monthlyBase * tdsPct / 100)
    : 0;
  const totalDeductions = foodDeduction + travelDeduction + pfDeduction + esicDeduction + tdsDeduction;
  const monthlyNet = Math.max(0, monthlyBase - totalDeductions);
  const annualNet = monthlyNet * 12;

  return (
    <div className="space-y-6 text-sm leading-relaxed text-slate-800 print:space-y-3">
      <p>Date: <strong>{date}</strong></p>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:p-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 print:mb-1">Employee Details</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4 text-slate-500 print:py-0.5">Name</td>
              <td className="py-1 font-medium text-slate-900 print:py-0.5">{name}</td>
            </tr>
            {identityCode ? (
              <tr>
                <td className="py-1 pr-4 text-slate-500 print:py-0.5">Unique Identity</td>
                <td className="py-1 font-medium text-slate-900 print:py-0.5">{identityCode}</td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 pr-4 text-slate-500 print:py-0.5">Designation</td>
              <td className="py-1 font-medium text-slate-900 capitalize print:py-0.5">{role}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-slate-500 print:py-0.5">Company</td>
              <td className="py-1 font-medium text-slate-900 print:py-0.5">{companyName}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-slate-500 print:py-0.5">Email</td>
              <td className="py-1 font-medium text-slate-900 print:py-0.5">{data.requester?.email ?? ""}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>This is to certify that <strong>{name}</strong> is employed with <strong>{companyName}</strong> as a <strong>{role}</strong>. The following are the salary details:</p>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 print:px-2 print:py-1">Component</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-700 print:px-2 print:py-1">Monthly (& INR)</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-700 print:px-2 print:py-1">Annual (& INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-white">
              <td className="px-4 py-2.5 text-slate-700 print:px-2 print:py-1">Basic Salary</td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900 print:px-2 print:py-1">{formatCurrency(monthlyBase)}</td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900 print:px-2 print:py-1">{formatCurrency(annualCtc)}</td>
            </tr>

            {foodDeduction > 0 ? (
              <tr className="bg-white">
                <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- Food Deduction</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(foodDeduction)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(foodDeduction * 12)}</td>
              </tr>
            ) : null}

            {travelDeduction > 0 ? (
              <tr className="bg-white">
                <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- Travel Accommodation</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(travelDeduction)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(travelDeduction * 12)}</td>
              </tr>
            ) : null}

            {!data.requester?.pfExempted ? (
              <tr className="bg-white">
                <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- PF Deduction ({pfPct}%)</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(pfDeduction)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(pfDeduction * 12)}</td>
              </tr>
            ) : null}

            {!data.requester?.esicExempted ? (
              <tr className="bg-white">
                <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- ESIC Deduction ({esicPct}%)</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(esicDeduction)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(esicDeduction * 12)}</td>
              </tr>
            ) : null}

            {!data.requester?.tdsExempted && tdsPct > 0 ? (
              <tr className="bg-white">
                <td className="px-4 py-2.5 text-slate-600 print:px-2 print:py-1">- TDS Deduction ({tdsPct}%)</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(tdsDeduction)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600 print:px-2 print:py-1">{formatCurrency(tdsDeduction * 12)}</td>
              </tr>
            ) : null}

            {totalDeductions > 0 ? (
              <tr className="bg-rose-50/50">
                <td className="px-4 py-2.5 font-medium text-rose-700 print:px-2 print:py-1">Total Deductions</td>
                <td className="px-4 py-2.5 text-right font-medium text-rose-700 print:px-2 print:py-1">{formatCurrency(totalDeductions)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-rose-700 print:px-2 print:py-1">{formatCurrency(totalDeductions * 12)}</td>
              </tr>
            ) : null}

            <tr className="bg-emerald-50">
              <td className="px-4 py-2.5 font-semibold text-emerald-800 print:px-2 print:py-1">In-Hand Salary (Net)</td>
              <td className="px-4 py-2.5 text-right font-bold text-emerald-800 print:px-2 print:py-1">{formatCurrency(monthlyNet)}</td>
              <td className="px-4 py-2.5 text-right font-bold text-emerald-800 print:px-2 print:py-1">{formatCurrency(annualNet)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {purpose ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 print:p-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purpose</p>
          <p className="mt-1 text-slate-700">{purpose}</p>
        </div>
      ) : null}

      <p className="text-xs text-slate-500 print:text-[9px]">
        This certificate is issued upon request and verified by the company.
      </p>

      <LetterSignature signer={signer} />
    </div>
  );
}

function LetterBody({ data, signer }: { data: LetterData; signer: LetterSigner | null }) {
  const name = data.metadata?.requesterName ?? data.requester?.name ?? "Employee";
  const role = data.metadata?.requesterRole ?? data.requester?.role ?? "Member";
  const companyName = data.company?.name ?? "Company";
  const type = data.metadata?.letterType ?? "";
  const purpose = data.metadata?.purpose ?? "";
  const customType = data.metadata?.customType ?? "";

  const identityCode = data.requester?.companyIdentityCode;

  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const joinDate = new Date(
    data.requester?.companyJoined ?? data.createdAt ?? Date.now(),
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const paragraphs: Record<string, string> = buildLetterParagraphs({
    name,
    role,
    companyName,
    joinDate,
    date,
    purpose,
    customType,
  });

  const editedBody = data.metadata?.letterContent ? String(data.metadata.letterContent) : "";

  return (
    <>
      <p>Date: {date}</p>
      <br />
      <p>TO,</p>
      <p><strong>{name}</strong><br />{role}<br />{companyName}</p>
      {identityCode ? <p className="text-xs text-slate-500">Unique Identity: {identityCode}</p> : null}
      <br />
      <p><strong>Subject: {LETTER_TITLES[type] || "Certificate"}</strong></p>
      <br />
      <p>Dear <strong>{name}</strong>,</p>
      <br />
      {editedBody ? (
        <p>{editedBody}</p>
      ) : (
        <p dangerouslySetInnerHTML={{ __html: paragraphs[type] || "" }} />
      )}
      <br />
      <p>We wish you the very best in your future endeavors.</p>
      <br />
      <p>Sincerely,</p>
      <p className="mt-2 font-medium">{data.approver?.name ?? companyName}</p>
      <p className="text-xs capitalize text-slate-500">{data.approver?.role ? `(${data.approver.role.replace("-", " ")})` : ""}</p>

      <LetterSignature signer={signer} />
    </>
  );
}

function ResignationLetterContent({ data, signer }: { data: LetterData; signer: LetterSigner | null }) {
  const name = data.metadata?.requesterName ?? data.requester?.name ?? "Employee";
  const role = data.metadata?.requesterRole ?? data.requester?.role ?? "Member";
  const companyName = data.company?.name ?? "Company";
  const joinDate = new Date(
    data.requester?.companyJoined ?? data.createdAt ?? Date.now(),
  ).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
  const lastWorkingDay = data.metadata?.resignationLastWorkingDay
    ? new Date(data.metadata.resignationLastWorkingDay).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "";
  const noticePeriod = data.metadata?.noticePeriodDays ?? "";
  const identityCode = data.requester?.companyIdentityCode;
  const teamName = data.metadata?.teamName ?? "";

  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-800 print:space-y-2">
      <p>Date: <strong>{date}</strong></p>
      <br />
      <p><strong>Subject: Resignation Letter</strong></p>
      <br />
      <p>Dear <strong>{data.approver?.name ?? "Human Resource"}</strong>,</p>
      <br />
      <p>
        Please accept this letter as formal notice of my resignation from my position as{" "}
        <strong>{role}</strong> at <strong>{companyName}</strong>.
        {lastWorkingDay ? (
          <> My last working day will be <strong>{lastWorkingDay}</strong>,{noticePeriod ? ` in accordance with my ${noticePeriod}-day notice period.` : "."}</>
        ) : null}
      </p>
      <br />
      <p>
        I joined <strong>{companyName}</strong> on <strong>{joinDate}</strong>, and I am grateful for the
        opportunities, support, and experiences I have gained during my tenure. Working with the team has been
        valuable for my professional and personal growth.
      </p>
      <br />
      <p>
        I will do my best to ensure a smooth transition of my responsibilities during the notice period. Please
        let me know how I can assist in this process.
      </p>
      <br />
      <p>Thank you for your guidance and support. I wish the company and the team continued success in the future.</p>
      <br />
      <p>Sincerely,</p>
      <br />
      <p className="font-semibold">{name}</p>
      {identityCode ? <p className="text-xs text-slate-500">ID: {identityCode}</p> : null}
      <p className="capitalize">{role}</p>
      <p>{companyName}</p>
      {teamName ? <p>Team: {teamName}</p> : null}
      <p className="text-slate-500">{data.requester?.email ?? ""}</p>
      <LetterSignature signer={signer} />
    </div>
  );
}

export default function LetterPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { data: session } = useSession();
  const [data, setData] = useState<LetterData | null>(null);
  const [salary, setSalary] = useState<SalaryInfo | null>(null);
  const [policy, setPolicy] = useState<PolicyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [justApproved, setJustApproved] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const editableTypes = [
    "experience",
    "offer-letter",
    "relieving",
    "final-settlement",
    "form-16",
    "noc",
    "exit-agreement",
    "other",
  ];

  useEffect(() => {
    if (!id) return;
    const draft = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("draft") === "1";
    setIsDraft(draft);

    apiFetch<{ requests: LetterData[] }>("/api/hr/document-letter")
      .then((res) => {
        const found = res.requests.find(
          (r) => r._id === id || r.id === id,
        );
        if (!found) {
          setError("Letter not found.");
          return;
        }
        if (found.status !== "approved" && !draft) {
          setError("This letter request has not been approved yet.");
          return;
        }
        setData(found);
        setSigned(Boolean(found.metadata?.isSigned));

        if (found.metadata?.letterType === "salary-certificate") {
          const bs = Number(found.requester?.baseSalary ?? 0);
          setSalary({ baseSalary: bs, netSalary: bs });

          apiFetch<PolicyInfo>("/api/finance/policy")
            .then((policyRes) => setPolicy(policyRes))
            .catch(() => {});
        }
      })
      .catch(() => setError("Failed to load letter."))
      .finally(() => setLoading(false));
  }, [id]);

  const type = data?.metadata?.letterType ?? "";
  const canEdit = editableTypes.includes(type);
  const approverId = data?.approver?._id;
  const canSign =
    Boolean(session?.user?.id) &&
    Boolean(approverId) &&
    String(session?.user?.id) === String(approverId);

  const signerName = data?.metadata?.signedBy || (signed ? (session?.user?.name ?? "") : "");
  const signerRole = data?.metadata?.signedRole || (signed ? (session?.user?.role ?? "") : "");
  const signerAt = data?.metadata?.signedAt || (signed ? new Date().toISOString() : "");
  const activeSigner: LetterSigner | null = signerName
    ? { name: signerName, role: signerRole, signedAt: signerAt }
    : null;

  const enterEdit = useCallback(() => {
    if (!data) return;
    const name = data.metadata?.requesterName ?? data.requester?.name ?? "Employee";
    const role = data.metadata?.requesterRole ?? data.requester?.role ?? "Member";
    const companyName = data.company?.name ?? "Company";
    const purpose = data.metadata?.purpose ?? "";
    const customType = data.metadata?.customType ?? "";
    const joinDate = new Date(
      data.requester?.companyJoined ?? data.createdAt ?? Date.now(),
    ).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const paras = buildLetterParagraphs({ name, role, companyName, joinDate, date, purpose, customType });
    const initial = data.metadata?.letterContent
      ? String(data.metadata.letterContent)
      : stripHtml(paras[type] || "");
    setDraftBody(initial);
    setEditing(true);
  }, [data, type]);

  async function doSign() {
    setSigning(true);
    try {
      setSigned(true);
    } finally {
      setSigning(false);
    }
  }

  async function doApprove() {
    if (!id) return;
    setApproving(true);
    try {
      const finalBody = editing ? draftBody : data?.metadata?.letterContent || undefined;
      await apiFetch(`/api/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved", signed: true, letterContent: finalBody }),
      });
      setJustApproved(true);
      setData((d) =>
        d
          ? {
              ...d,
              status: "approved",
              metadata: {
                ...d.metadata,
                isSigned: true,
                signedBy: session?.user?.name ?? "",
                signedRole: session?.user?.role ?? "",
                signedAt: new Date().toISOString(),
                letterContent: finalBody,
              },
            }
          : d,
      );
      setToast({ text: "Letter approved and signed.", type: "success" });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : "Could not approve letter.",
        type: "error",
      });
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-slate-500">Loading letter...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-red-600">{error || "Letter not available."}</p>
      </div>
    );
  }

  const companyName = data.company?.name ?? "Company";
  const companyIcon = data.company?.icon ?? "";
  const title = LETTER_TITLES[type] || "Certificate";

  const showFinal = !isDraft || justApproved;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {toast ? (
        <div
          className={`fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-semibold shadow-lg ${
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {isDraft && !justApproved ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              DRAFT · Pending approval
            </span>
          ) : null}
        </div>
        {showFinal ? (
          <button
            className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => window.print()}
          >
            Download PDF
          </button>
        ) : null}
      </div>

      {isDraft && !justApproved ? (
        <div className="sticky top-[57px] z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-6 py-3 print:hidden">
          {editing ? (
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Done editing
            </button>
          ) : canEdit ? (
            <button
              onClick={enterEdit}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Edit letter
            </button>
          ) : null}

          {canSign && !signed ? (
            <button
              onClick={doSign}
              disabled={signing}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {signing ? "Signing..." : "E-Sign"}
            </button>
          ) : null}

          {canSign && signed ? (
            <>
              <button
                onClick={doApprove}
                disabled={approving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {approving ? "Approving..." : "Approve"}
              </button>
              <button
                onClick={() => window.close()}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </>
          ) : null}

          {!canSign ? (
            <p className="text-xs text-slate-500">
              Only the assigned approver can sign and approve this request.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow-lg print:mx-auto print:min-h-screen print:shadow-none print:p-6 print:text-[11px]">
        {justApproved ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Letter approved and signed. You can now download or print it.
          </div>
        ) : null}

        <div className="mb-8 text-center print:mb-4">
          <div className="flex items-center justify-center gap-3">
            {companyIcon ? (
              <img src={companyIcon} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : null}
            <h2 className="text-2xl font-bold uppercase tracking-wide text-slate-900 print:text-xl">
              {companyName}
            </h2>
          </div>
          <div className="mx-auto mt-3 h-0.5 w-20 bg-indigo-600 print:mt-1" />
        </div>

        {data.requester?.pfNumber || data.requester?.esicNumber ? (
          <div className="mb-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 print:mb-3 print:text-[9px]">
            {data.requester?.pfNumber ? (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1">
                PF: <strong className="text-slate-800">{data.requester.pfNumber}</strong>
                {data.requester.pfDeductionAmount ? (
                  <span className="ml-1 text-slate-400">(₹{data.requester.pfDeductionAmount})</span>
                ) : null}
              </span>
            ) : null}
            {data.requester?.esicNumber ? (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1">
                ESIC: <strong className="text-slate-800">{data.requester.esicNumber}</strong>
                {data.requester.esicDeductionAmount ? (
                  <span className="ml-1 text-slate-400">(₹{data.requester.esicDeductionAmount})</span>
                ) : null}
              </span>
            ) : null}
          </div>
        ) : null}

        {editing && canEdit ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Edit letter body</p>
            <textarea
              className="w-full min-h-[40vh] rounded-md border border-slate-300 p-4 text-sm leading-relaxed text-slate-800"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
            />
            <p className="text-xs text-slate-400">Edits are saved when you approve the letter.</p>
          </div>
        ) : type === "salary-certificate" ? (
          <SalaryCertificateContent data={data} salary={salary} policy={policy} signer={activeSigner} />
        ) : type === "internship" ? (
          <InternshipCertificateContent data={data} signer={activeSigner} />
        ) : type === "resignation" ? (
          <div className="space-y-4 text-sm leading-relaxed text-slate-800">
            <ResignationLetterContent data={data} signer={activeSigner} />
          </div>
        ) : type === "employee-recognition" ? (
          <EmployeeRecognitionContent data={data} signer={activeSigner} />
        ) : (
          <div className="space-y-4 text-sm leading-relaxed text-slate-800">
            <LetterBody data={data} signer={activeSigner} />
          </div>
        )}

        <div className="mt-12 border-t border-slate-200 pt-4 text-center text-xs text-slate-400 print:mt-6 print:pt-2 print:text-[9px]">
          Generated by FlowZen  ·  {new Date().toLocaleDateString("en-IN")}
        </div>
      </div>
    </div>
  );
}
