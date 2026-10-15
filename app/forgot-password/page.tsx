import { AuthExperience } from "@/components/auth/auth-experience";

export default function ForgotPasswordPage() {
  return <AuthExperience initialView="login" initialForgotOpen={true} />;
}
