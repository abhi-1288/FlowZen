export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

export type Stage =
  | "applied"
  | "screening"
  | "technical-interview"
  | "manager-round"
  | "hr-round"
  | "offer"
  | "joined"
  | "rejected";

export const STAGES: Stage[] = [
  "applied",
  "screening",
  "technical-interview",
  "manager-round",
  "hr-round",
  "offer",
  "joined",
  "rejected",
];

export const STAGE_LABELS: Record<Stage, string> = {
  applied: "Applied",
  screening: "Screening",
  "technical-interview": "Technical Interview",
  "manager-round": "Manager Round",
  "hr-round": "HR Round",
  offer: "Offer",
  joined: "Joined",
  rejected: "Rejected",
};

export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";
export type SalaryType = "per-annum" | "per-month";
export type JobStatus = "draft" | "open" | "closed";
export type Source = "Referral" | "LinkedIn" | "Company Website" | "Naukri" | "Indeed" | "Walk-In" | "Other";
export type RoundType = "screening" | "technical" | "manager" | "hr";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";
export type Recommendation = "strong-hire" | "hire" | "hold" | "reject";
export type OfferStatus = "draft" | "sent" | "accepted" | "rejected";
export type ReferralStatus = "pending" | "reviewed" | "hired" | "rejected";
export type TimelineAction =
  | "applied"
  | "resume-uploaded"
  | "interview-scheduled"
  | "interview-completed"
  | "offer-generated"
  | "offer-accepted"
  | "offer-rejected"
  | "stage-changed"
  | "joined"
  | "rejected"
  | "note-added";

export type ATSJob = {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  salaryRangeMin: number;
  salaryRangeMax: number;
  salaryType: SalaryType;
  currency: string;
  openings: number;
  autoCloseDate: string | null;
  description: string;
  requiredSkills: string[];
  status: JobStatus;
  createdBy: string;
  company: string;
  createdAt: string;
  updatedAt: string;
};

export type ATSCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentCompany: string;
  experienceYears: number;
  currentCTC: number;
  expectedCTC: number;
  noticePeriod: number;
  source: Source;
  stage: Stage;
  rating: number;
  notes: string;
  resumeUrl: string;
  portfolioUrl: string;
  linkedInUrl: string;
  assignedRecruiter: { id: string; name: string; email: string } | string | null;
  assignedTeam: Array<{
    role: string;
    user: { id: string; name: string } | string;
    roundType: string;
    status: string;
    feedback: string;
  }>;
  stageChangeRequest: {
    requestedStage: string;
    requestedBy: { id: string; name: string } | string | null;
    feedback: string;
    status: string;
  };
  job: { id: string; title: string } | string;
  company: string;
  createdAt: string;
  updatedAt: string;
};

export type ATSInterview = {
  id: string;
  candidate: { id: string; firstName: string; lastName: string } | string;
  job: { id: string; title: string } | string;
  interviewer: { id: string; name: string; email: string } | string;
  roundType: RoundType;
  scheduledAt: string;
  meetingLink: string;
  status: InterviewStatus;
  feedback: {
    technicalSkills: number;
    communication: number;
    problemSolving: number;
    cultureFit: number;
    overallRecommendation: Recommendation;
    notes: string;
  };
  createdBy: string;
  company: string;
  createdAt: string;
  updatedAt: string;
};

export type ATSOffer = {
  id: string;
  candidate: { id: string; firstName: string; lastName: string } | string;
  job: { id: string; title: string } | string;
  offeredCTC: number;
  salaryType: SalaryType;
  pfAmount: number;
  esicAmount: number;
  joiningDate: string | null;
  designation: string;
  department: string;
  offerLetterUrl: string;
  officeLocation: string;
  perks: string;
  status: OfferStatus;
  createdBy: string;
  company: string;
  createdAt: string;
  updatedAt: string;
};

export type ATSTimelineEntry = {
  id: string;
  candidate: string;
  job: string;
  action: TimelineAction;
  metadata: Record<string, unknown>;
  actor: { id: string; name: string } | string | null;
  company: string;
  createdAt: string;
  updatedAt: string;
};

export type ATSReferral = {
  id: string;
  employee: { id: string; name: string } | string;
  candidate: { id: string; firstName: string; lastName: string } | string;
  status: ReferralStatus;
  referralBonusEligible: boolean;
  company: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardData = {
  openPositions: number;
  totalCandidates: number;
  interviewsThisWeek: number;
  offersSent: number;
  offersAccepted: number;
  hiringFunnel: { stage: Stage; count: number }[];
  sourcePerformance: { source: Source; count: number }[];
};
