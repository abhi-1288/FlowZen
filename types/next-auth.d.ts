import "next-auth";

declare module "next-auth" {
  interface User {
    role?: "employee" | "project-manager" | "qa-tester" | "human-resource" | "finance" | "admin" | "others";
    passwordResetRequired?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role?: "employee" | "project-manager" | "qa-tester" | "human-resource" | "finance" | "admin" | "others";
      name?: string | null;
      email?: string | null;
      image?: string | null;
      company?: string | null;
      team?: string | null;
      teamId?: string | null;
      managedTeamCount?: number;
      passwordResetRequired?: boolean;
    };
  }
}
