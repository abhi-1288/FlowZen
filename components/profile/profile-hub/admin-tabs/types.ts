
export type MeetingDuration = 15 | 30 | 45 | 60 | 90 | 120;

export type HrMemberRoleKey = typeof HR_MEMBER_ROLE_KEYS[number];

export const MEETING_DURATION_OPTIONS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1.5 hours" },
  { minutes: 120, label: "2 hours" },
] as const satisfies { minutes: MeetingDuration; label: string }[];

export const HR_MEMBER_ROLE_KEYS = [
  "human-resource",
  "project-manager",
  "qa-tester",
  "finance",
  "admin",
  "employee",
  "others",
] as const;

export type QuitNoticeInfo = {
  noticeDays: number;
  elapsedDays: number;
  remainingDays: number;
  canApprove: boolean;
};

export type DocModalData = {
  member: { name: string; email: string; role: string };
  categories: { name: string; mandatory: boolean; fields: { label: string; type: string }[] }[];
  documents: { category: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; fieldValues: { label: string; value: string }[] }[];
};
