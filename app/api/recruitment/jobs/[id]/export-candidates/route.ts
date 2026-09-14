import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSReferral } from "@/models/ATSReferral";
import { User } from "@/models/User";
import { STAGE_LABELS, type Stage } from "@/lib/recruitment-types";
import { parseResumeFromUrl } from "@/lib/resume-parser";

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

/** Escape a value for CSV output. */
function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Keep long phone numbers as text so Excel doesn't show scientific notation. */
function csvPhone(value: unknown): string {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/[^+\d]/g, "");
  if (!digits) return "";
  if (/^\+?\d{8,}$/.test(digits)) return `="${digits}"`;
  return digits;
}

function safeFilenamePart(value: unknown) {
  return (
    String(value ?? "job")
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "job"
  );
}

function shortDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("title status");
  if (!job) return jsonError("Job not found.", 404);
  if (job.status !== "closed") return jsonError("Candidate export is available after the job is closed.", 400);

  const candidates = await ATSCandidate.find({ job: id, company: user.company }).sort({ createdAt: 1 }).lean();

  const referralRecords = await ATSReferral.find({ job: id, company: user.company })
    .select("candidate referralId")
    .lean();
  const referralByCandidate = new Map<string, string>();
  for (const r of referralRecords) {
    referralByCandidate.set(String(r.candidate), r.referralId || "");
  }

  const headings = [
    "S.No",
    "First Name",
    "Last Name",
    "Email",
    "Mobile",
    "Date of Birth",
    "Address",
    "Blood Group",
    "Emergency Contact",
    "Highest Qualification",
    "Skills",
    "Stage",
    "Source",
    "Current Company",
    "Total Experience (years)",
    "Internship (months)",
    "Notice Period (days)",
    "Cover Letter / Notes",
    "Portfolio URL",
    "LinkedIn URL",
    "Resume URL",
    "Applied On",
    "ATS Score",
    "ATS Status",
    "Assessment Score",
    "Assessment Status",
  ];

  const rows: string[] = [headings.map(csvCell).join(",")];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];

    let parsed: {
      name: string;
      email: string;
      phone: string;
      dob: string;
      address: string;
      bloodGroup: string;
      emergencyContact: string;
      highestQualification: string;
      currentCompany: string;
      totalExperience: string;
      skills: string;
    } | null = null;

    if (c.resumeUrl) {
      try {
        parsed = await parseResumeFromUrl(c.resumeUrl);
      } catch {
        parsed = null;
      }
    }

    const firstName = c.firstName || parsed?.name?.split(" ")[0] || "";
    const lastName = c.lastName ?? (parsed?.name?.split(" ").slice(1).join(" ") ?? "");
    const email = c.email || parsed?.email || "";
    const phone = c.phone || parsed?.phone || "";
    const dob = (c as any).dob ? shortDate((c as any).dob) : parsed?.dob || "";
    const address = (c as any).address || parsed?.address || "";
    const qualification = parsed?.highestQualification || "";
    const storedExperience = c.experienceYears ?? 0;
    const experience =
      storedExperience > 0 || !parsed?.totalExperience ? storedExperience : parsed.totalExperience;
    const internshipMonths = (c as any).internshipExperienceMonths ?? 0;
    const notes = Array.isArray((c as any).notes)
      ? (c as any).notes
          .map((n: any) => (n && typeof n.content === "string" ? n.content : ""))
          .filter(Boolean)
          .join("; ")
      : "";

    let source = c.source || "";
    if (String(source).toLowerCase() === "referral") {
      const referralId = referralByCandidate.get(String((c as any)._id));
      if (referralId) source = `Referral: ${referralId}`;
    }

    rows.push(
      [
        i + 1,
        firstName,
        lastName,
        email,
        csvPhone(phone),
        dob,
        address,
        parsed?.bloodGroup || "",
        parsed?.emergencyContact || "",
        qualification,
        parsed?.skills || "",
        STAGE_LABELS[String(c.stage) as Stage] ?? c.stage,
        source,
        c.currentCompany || parsed?.currentCompany || "",
        experience,
        internshipMonths,
        c.noticePeriod ?? 0,
        notes,
        c.portfolioUrl || "",
        c.linkedInUrl || "",
        c.resumeUrl || "",
        shortDate(c.createdAt),
        c.atsScore ?? "",
        c.atsStatus ?? "",
        c.assessmentScore ?? "",
        c.assessmentStatus ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  // BOM helps Excel open UTF-8 CSV with non-ASCII characters.
  const csv = "\uFEFF" + rows.join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  const filename = `candidates-${safeFilenamePart(job.title)}-${date}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}