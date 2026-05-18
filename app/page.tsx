import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/landing/landing-page";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect("/profile");
  }

  return <LandingPage />;
}
