import "next-auth";

declare module "next-auth" {
  interface User {
    role?: "employee" | "project-manager" | "qa-tester" | "human-resource" | "admin" | "others";
  }

  interface Session {
    user: {
      id: string;
      role?: "employee" | "project-manager" | "qa-tester" | "human-resource" | "admin" | "others";
      name?: string | null;
      email?: string | null;
      image?: string | null;
      company?: string | null;
      team?: string | null;
    };
  }
}
