"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  };
  requester: {
    _id: string;
    name: string;
    email: string;
    role: string;
    companyIdentityCode?: string;
    companyJoined?: string;
  };
  approver?: { _id: string; name: string; role: string };
  company: { _id: string; name: string };
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
};

type SignatoryInfo = {
  name: string;
  role: string;
};

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
  other: "Certificate",
};

function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

function isOptedOut(members: { _id?: string }[] | undefined, userId: string): boolean {
  if (!members || members.length === 0) return false;
  return members.some((m) => String(m._id ?? "") === userId);
}

function SignatureBlock({ name, role }: SignatoryInfo) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 print:text-[8px]">
        Sign by {role}
      </p>
      <div className="mb-1 h-10 w-48 border-b border-slate-400 print:h-6 print:w-36" />
      <p className="text-sm font-medium text-slate-900 print:text-[10px]">{name}</p>
      <p className="text-xs capitalize text-slate-500 print:text-[9px]">{role}</p>
    </div>
  );
}

function InternshipCertificateContent({
  data, signatories,
}: {
  data: LetterData; signatories: SignatoryInfo[];
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

      <div className="pt-8 print:pt-3">
        <p className="mb-8 text-xs font-semibold uppercase tracking-wider text-slate-500 print:mb-3">Authorized Signatories</p>
        <div className="grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 print:gap-x-6 print:gap-y-3">
          {signatories.map((s, i) => <SignatureBlock key={i} name={s.name} role={s.role} />)}
        </div>
      </div>
    </div>
  );
}

function SalaryCertificateContent({
  data,
  salary,
  policy,
  signatories,
}: {
  data: LetterData;
  salary: SalaryInfo | null;
  policy: PolicyInfo | null;
  signatories: SignatoryInfo[];
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
  const totalDeductions = foodDeduction + travelDeduction;
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

      <div className="pt-8 print:pt-3">
        <p className="mb-8 text-xs font-semibold uppercase tracking-wider text-slate-500 print:mb-3">
          Authorized Signatories
        </p>
        <div className="grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 print:gap-x-6 print:gap-y-3">
          {signatories.map((s, i) => (
            <SignatureBlock key={i} name={s.name} role={s.role} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LetterBody({ data, signatories }: { data: LetterData; signatories: SignatoryInfo[] }) {
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

  const paragraphs: Record<string, string> = {
    experience: `This is to certify that <strong>${name}</strong> has been employed with <strong>${companyName}</strong> in the capacity of <strong>${role}</strong> from ${joinDate} to date. During this period, they have demonstrated professionalism, dedication, and strong performance in their role.`,
    "offer-letter": `We are pleased to offer <strong>${name}</strong> the position of <strong>${role}</strong> at <strong>${companyName}</strong>. We look forward to a successful association.`,
    relieving: `This is to confirm that <strong>${name}</strong>, who served as <strong>${role}</strong> at <strong>${companyName}</strong> since ${joinDate}, has been relieved from their duties effective ${date}. They have completed all pending assignments and clearance formalities.`,
    internship: `This is to certify that <strong>${name}</strong> completed their internship with <strong>${companyName}</strong> as a <strong>${role}</strong> from ${joinDate}. During this period, they exhibited enthusiasm and a strong willingness to learn.`,
    other: customType
      ? `This is to certify that <strong>${name}</strong> has been associated with <strong>${companyName}</strong> as a <strong>${role}</strong>. Purpose: ${purpose}.`
      : "",
  };

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
      <p dangerouslySetInnerHTML={{ __html: paragraphs[type] || "" }} />
      <br />
      <p>We wish you the very best in your future endeavors.</p>
      <br />
      <p>Sincerely,</p>
      <p className="mt-2 font-medium">{data.approver?.name ?? companyName}</p>
      <p className="text-xs capitalize text-slate-500">{data.approver?.role ? `(${data.approver.role.replace("-", " ")})` : ""}</p>

      <div className="mt-10 print:mt-4">
        <p className="mb-6 text-[10px] font-semibold uppercase tracking-widest text-slate-400 print:mb-2">
          Sign by Human Resource
        </p>
        <div className="h-10 w-48 border-b border-slate-400 print:h-6" />
        <p className="mt-1 text-sm font-medium text-slate-900">
          {signatories.find((s) => s.role === "Human Resource")?.name ?? data.approver?.name ?? companyName}
        </p>
        <p className="text-xs capitalize text-slate-500">Human Resource</p>
      </div>
    </>
  );
}

function ResignationLetterContent({ data }: { data: LetterData }) {
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
    </div>
  );
}

export default function LetterPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [data, setData] = useState<LetterData | null>(null);
  const [salary, setSalary] = useState<SalaryInfo | null>(null);
  const [policy, setPolicy] = useState<PolicyInfo | null>(null);
  const [signatories, setSignatories] = useState<SignatoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch<{ requests: LetterData[] }>("/api/hr/document-letter")
      .then((res) => {
        const found = res.requests.find(
          (r) => r._id === id || r.id === id,
        );
        if (!found) {
          setError("Letter not found.");
          return;
        }
        if (found.status !== "approved") {
          setError("This letter request has not been approved yet.");
          return;
        }
        setData(found);

        const isInternship = found.metadata?.letterType === "internship";

        const sigPromises: Promise<SignatoryInfo | null>[] = [];

        if (isInternship) {
          sigPromises.push(
            apiFetch<{ users: { name: string }[] }>("/api/users?role=human-resource")
              .then((r) => (r.users?.[0] ? { name: r.users[0].name, role: "Human Resource" } : null))
              .catch(() => null),
          );
          if (found.metadata?.teamManagerName) {
            sigPromises.push(
              Promise.resolve({ name: found.metadata.teamManagerName, role: formatRole(found.metadata.teamManagerRole ?? "") }),
            );
          }
        } else {
          sigPromises.push(
            apiFetch<{ users: { name: string }[] }>("/api/users?role=admin")
              .then((r) => (r.users?.[0] ? { name: r.users[0].name, role: "Admin" } : null))
              .catch(() => null),
            apiFetch<{ users: { name: string }[] }>("/api/users?role=human-resource")
              .then((r) => (r.users?.[0] ? { name: r.users[0].name, role: "Human Resource" } : null))
              .catch(() => null),
            apiFetch<{ users: { name: string }[] }>("/api/users?role=finance")
              .then((r) => (r.users?.[0] ? { name: r.users[0].name, role: "Finance" } : null))
              .catch(() => null),
          );
          if (found.metadata?.teamManagerName) {
            sigPromises.push(
              Promise.resolve({ name: found.metadata.teamManagerName, role: "Manager/Tester" }),
            );
          }
        }

        Promise.all(sigPromises).then((results) => {
          setSignatories(results.filter((s): s is SignatoryInfo => s !== null));
        });

        if (found.metadata?.letterType === "salary-certificate") {
          const currentMonth = new Date().toISOString().slice(0, 7);

          apiFetch<{ insights?: { baseSalary?: number }; user?: { baseSalary?: number } }>("/api/profile")
            .then((profileRes) => {
              const bs = profileRes?.user?.baseSalary ?? profileRes?.insights?.baseSalary ?? 0;
              setSalary({ baseSalary: Number(bs), netSalary: Number(bs) });

              apiFetch<PolicyInfo>("/api/finance/policy")
                .then((policyRes) => setPolicy(policyRes))
                .catch(() => {});

              apiFetch<{ salaries?: { baseSalary: number; netSalary: number }[] }>(
                `/api/finance?month=${currentMonth}`
              )
                .then((financeRes) => {
                  const ownSalary = financeRes?.salaries?.[0];
                  if (ownSalary) {
                    setSalary((prev) => ({
                      baseSalary: Number(ownSalary.baseSalary ?? prev?.baseSalary ?? bs),
                      netSalary: Number(ownSalary.netSalary ?? ownSalary.baseSalary ?? prev?.baseSalary ?? bs),
                    }));
                  }
                })
                .catch(() => {});
            })
            .catch(() => {});
        }
      })
      .catch(() => setError("Failed to load letter."))
      .finally(() => setLoading(false));
  }, [id]);

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
  const type = data.metadata?.letterType ?? "";
  const title = LETTER_TITLES[type] || "Certificate";

  const isInternship = type === "internship";

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <button
          className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => window.print()}
        >
          Download PDF
        </button>
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow-lg print:mx-auto print:min-h-screen print:shadow-none print:p-6 print:text-[11px]">
        <div className="mb-8 text-center print:mb-4">
          <h2 className="text-2xl font-bold uppercase tracking-wide text-slate-900 print:text-xl">
            {companyName}
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-20 bg-indigo-600 print:mt-1" />
        </div>

        {type === "salary-certificate" ? (
          <SalaryCertificateContent data={data} salary={salary} policy={policy} signatories={signatories} />
        ) : type === "internship" ? (
          <InternshipCertificateContent data={data} signatories={signatories} />
        ) : type === "resignation" ? (
          <div className="space-y-4 text-sm leading-relaxed text-slate-800">
            <ResignationLetterContent data={data} />
          </div>
        ) : (
          <div className="space-y-4 text-sm leading-relaxed text-slate-800">
            <LetterBody data={data} signatories={signatories} />
          </div>
        )}

        <div className="mt-12 border-t border-slate-200 pt-4 text-center text-xs text-slate-400 print:mt-6 print:pt-2 print:text-[9px]">
          Generated by FlowZen  ·  {new Date().toLocaleDateString("en-IN")}
        </div>
      </div>
    </div>
  );
}
