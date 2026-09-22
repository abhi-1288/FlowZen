import type { Period, Variant } from "./types";

export interface CommandCenterContext {
  userId: string;
  role: string;
  isSeniorSecurity: boolean;
  companyId: string | null;
  userName: string;
  companyName: string;
  companyColor: string;
  variant: Variant;
  period: Period;
  now: Date;
}