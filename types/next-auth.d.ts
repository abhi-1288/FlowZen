import "next-auth";
import "next-auth/jwt";

export type AppUserRole =
  | "employee"
  | "project-manager"
  | "qa-tester"
  | "human-resource"
  | "finance"
  | "admin"
  | "security"
  | "it-admin"
  | "it-administration"
  | "others";

declare module "next-auth" {
  interface User {
    role?: AppUserRole;
    passwordResetRequired?: boolean;
    rememberMe?: boolean;
    isSeniorSecurity?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role?: AppUserRole;
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
    role?: AppUserRole;
    passwordResetRequired?: boolean;
    rememberMe?: boolean;
    isSeniorSecurity?: boolean;
  }
}
