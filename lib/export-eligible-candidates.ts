import * as XLSX from "xlsx-js-style";
import type { ATSCandidate } from "@/lib/recruitment-types";

export type ExportInterview = {
  candidate?: { id?: string } | string | null;
  roundType?: string;
  scheduledAt?: string;
  status?: string;
  feedback?: {
    technicalSkills?: number;
    communication?: number;
    problemSolving?: number;
    cultureFit?: number;
    overallRecommendation?: string;
    notes?: string;
  };
};

export type ExportTab = {
  key: string;
  label: string;
  candidates: ATSCandidate[];
};

const HEADER_FILL = { fgColor: { rgb: "FF1F2937" } };
const HEADER_FONT = { bold: true, color: { rgb: "FFFFFFFF" }, sz: 11 };
const GREEN = { fill: { fgColor: { rgb: "FFD1FAE5" } }, font: { color: { rgb: "FF065F46" } } };
const RED = { fill: { fgColor: { rgb: "FFFEE2E2" } }, font: { color: { rgb: "FF991B1B" } } };
const AMBER = { fill: { fgColor: { rgb: "FFFEF3C7" } }, font: { color: { rgb: "FF92400E" } } };
const BLUE = { fill: { fgColor: { rgb: "FFDBEAFE" } }, font: { color: { rgb: "FF1E40AF" } } };
const GRAY = { fill: { fgColor: { rgb: "FFF3F4F6" } }, font: { color: { rgb: "FF374151" } } };

type Cell = { v: unknown; t?: string; s?: Record<string, unknown> };

function styleForStage(stage: string): Record<string, unknown> {
  if (["joined", "offer", "assessment-pass"].includes(stage)) return GREEN;
  if (["rejected", "ats-rejected", "assessment-fail", "not-assessed"].includes(stage)) return RED;
  if (["assessment", "screening"].includes(stage)) return AMBER;
  if (stage.includes("interview") || stage.includes("round")) return BLUE;
  return GRAY;
}

function styleForScore(score: number | null | undefined): Record<string, unknown> {
  if (score == null) return GRAY;
  if (score >= 70) return GREEN;
  if (score >= 40) return AMBER;
  return RED;
}

function styleForRating(rating: number | null | undefined): Record<string, unknown> {
  if (rating == null) return GRAY;
  if (rating >= 4) return GREEN;
  if (rating >= 3) return AMBER;
  return RED;
}

function styleForVerdict(value: string | null | undefined): Record<string, unknown> {
  if (!value) return GRAY;
  const v = value.toLowerCase();
  if (["selected", "passed", "pass", "hire", "strong-hire", "accepted", "joined"].includes(v)) return GREEN;
  if (["rejected", "failed", "fail", "reject", "declined"].includes(v)) return RED;
  if (v) return AMBER;
  return GRAY;
}

function fmtDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function cell(v: unknown, style?: Record<string, unknown>): Cell {
  if (v == null) return { v: "", t: "s", s: style };
  if (typeof v === "number") return { v, t: "n", s: style };
  if (typeof v === "object") {
    try {
      return { v: JSON.stringify(v), t: "s", s: style };
    } catch {
      return { v: "", t: "s", s: style };
    }
  }
  return { v: String(v), t: "s", s: style };
}

function interviewText(candidateId: string, interviews: ExportInterview[]): string {
  const rows = interviews.filter((i) => {
    const c = (i as any).candidate;
    const id = c && typeof c === "object" ? String(c.id ?? "") : String(c ?? "");
    return id === candidateId;
  });
  if (!rows.length) return "";
  return rows
    .map((i) => {
      const fb = i.feedback ?? {};
      const parts = [
        `Round: ${i.roundType ?? "-"}`,
        `Date: ${fmtDate(i.scheduledAt)}`,
        `Status: ${i.status ?? "-"}`,
        `Tech: ${fb.technicalSkills ?? "-"}/5`,
        `Comms: ${fb.communication ?? "-"}/5`,
        `Problem: ${fb.problemSolving ?? "-"}/5`,
        `Culture: ${fb.cultureFit ?? "-"}/5`,
        `Verdict: ${fb.overallRecommendation ?? "-"}`,
      ];
      if (fb.notes) parts.push(`Notes: ${fb.notes}`);
      return parts.join(" | ");
    })
    .join("\n");
}

const HEADERS = [
  "Name", "Email", "Phone", "Stage", "Source", "Current Company", "Experience (yrs)",
  "Internship (months)", "Notice Period (days)", "Current CTC", "Expected CTC",
  "ATS Score", "ATS Status", "ATS Reason", "ATS Rejection Note", "ATS Scored At",
  "Assessment Score", "Assessment Status", "Assessment Reason", "Assessment Rejection Note",
  "Assessment Domain", "Assessment Raw Marks", "Assessment Max Marks", "Assessment Started",
  "Assessment Submitted", "Assessment Invite Sent At", "Edit Invite Sent At",
  "Result Published At", "Assigned Slot (IST)", "Rating", "Region", "Joining Region",
  "Previous Joining Region", "Assigned Recruiter", "DOB", "Address", "Resume URL",
  "Portfolio URL", "LinkedIn URL", "Internal Notes", "Stage Change Request",
  "Applied At", "Updated At", "Interview Feedback",
];

function rowForCandidate(c: ATSCandidate, interviews: ExportInterview[]): Cell[] {
  const stage = String(c.stage ?? "");
  return [
    cell(`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()),
    cell(c.email),
    cell(c.phone),
    cell(stage, styleForStage(stage)),
    cell((c as any).source),
    cell((c as any).currentCompany),
    cell((c as any).experienceYears),
    cell((c as any).internshipExperienceMonths),
    cell((c as any).noticePeriod),
    cell((c as any).currentCTC),
    cell((c as any).expectedCTC),
    cell((c as any).atsScore, styleForScore((c as any).atsScore)),
    cell((c as any).atsStatus, styleForVerdict((c as any).atsStatus)),
    cell((c as any).atsReason),
    cell((c as any).atsRejectionNote),
    cell(fmtDate((c as any).atsScoredAt)),
    cell((c as any).assessmentScore, styleForScore((c as any).assessmentScore)),
    cell((c as any).assessmentStatus, styleForVerdict((c as any).assessmentStatus)),
    cell((c as any).assessmentReason),
    cell((c as any).assessmentRejectionNote),
    cell((c as any).assessmentDomain),
    cell((c as any).assessmentRawMarks),
    cell((c as any).assessmentMaxMarks),
    cell(fmtDate((c as any).assessmentStartedAt)),
    cell(fmtDate((c as any).assessmentSubmittedAt)),
    cell(fmtDate((c as any).assessmentInviteSentAt)),
    cell(fmtDate((c as any).editApplicationInviteSentAt)),
    cell(fmtDate((c as any).assessmentResultPublishedAt)),
    cell(fmtDate((c as any).assessmentSlotStart)),
    cell((c as any).rating, styleForRating((c as any).rating)),
    cell((c as any).regionLabel),
    cell((c as any).joiningRegionLabel),
    cell((c as any).previousJoiningRegionLabel),
    cell((c as any).assignedRecruiter),
    cell(fmtDate((c as any).dob)),
    cell((c as any).address),
    cell(c.resumeUrl),
    cell(c.portfolioUrl),
    cell(c.linkedInUrl),
    cell((c as any).notes),
    cell((c as any).stageChangeRequest),
    cell(fmtDate(c.createdAt)),
    cell(fmtDate(c.updatedAt)),
    cell(interviewText(c.id, interviews)),
  ];
}

/**
 * Build one worksheet per tab with styled headers and colour-coded cells.
 * xlsx-js-style is used because the community `xlsx` package drops styles on write.
 */
export function buildEligibleCandidatesWorkbook(tabs: ExportTab[], interviews: ExportInterview[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const tab of tabs) {
    const headerRow = HEADERS.map((h) => ({ v: h, t: "s", s: { fill: HEADER_FILL, font: HEADER_FONT, alignment: { vertical: "center", horizontal: "center", wrapText: true } } })) as Cell[];
    const dataRows = tab.candidates.map((c) => rowForCandidate(c, interviews));
    const aoa: Cell[][] = [headerRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa as any, { cellStyles: true });

    ws["!rows"] = [{ hpt: 30 }, ...tab.candidates.map(() => ({ hpt: 18 }))];
    ws["!cols"] = HEADERS.map((h, i) => {
      const widest = tab.candidates.reduce((max, c) => {
        const v = rowForCandidate(c, interviews)[i]?.v;
        return Math.max(max, String(v ?? "").length);
      }, h.length);
      return { wch: Math.min(60, Math.max(10, widest + 2)) };
    });
    // Name the sheet after the tab, sanitised for Excel's 31-char limit.
    const name = tab.label.replace(/[\\/?*\[\]:]/g, "").slice(0, 31) || "Sheet";
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true }) as ArrayBuffer;
}
