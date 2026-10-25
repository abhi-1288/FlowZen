export const APP_ROLES = [
  "employee",
  "project-manager",
  "qa-tester",
  "human-resource",
  "finance",
  "admin",
  "security",
  "it-admin",
  "it-administration",
  "others",
  "warehouse",
] as const;

export type AppRole = (typeof APP_ROLES)[number];