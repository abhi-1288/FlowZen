import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    role?: "employee" | "project-manager" | "qa-tester" | "human-resource" | "admin" | "others";
  }
}
