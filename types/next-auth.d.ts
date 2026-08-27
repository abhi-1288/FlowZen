import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: "employee" | "project-manager" | "qa-tester" | "human-resource" | "finance" | "admin" | "security" | "others";
    passwordResetRequired?: boolean;
    rememberMe?: boolean;
    isSeniorSecurity?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role?: "employee" | "project-manager" | "qa-tester" | "human-resource" | "finance" | "admin" | "security" | "others";
      name?: string | null;
      email?: string | null;
      image?: string | null;
      company?: string | null;
      companyColor?: string | null;
      team?: string | null;
      teamId?: string | null;
      managedTeamCount?: number;
      passwordResetRequired?: boolean;
      rememberMe?: boolean;
      isSeniorSecurity?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "employee" | "project-manager" | "qa-tester" | "human-resource" | "finance" | "admin" | "security" | "others";
    passwordResetRequired?: boolean;
    rememberMe?: boolean;
    isSeniorSecurity?: boolean;
  }
}
