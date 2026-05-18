import "next-auth";

declare module "next-auth" {
  interface User {
    role?: "employee" | "project-manager" | "qa-tester" | "admin";
  }

  interface Session {
    user: {
      id: string;
      role?: "employee" | "project-manager" | "qa-tester" | "admin";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
