import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/landing/landing-page";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  
  if (session?.user?.companySlug) {
    const host = process.env.BASE_DOMAIN || "localhost";
    if (host !== "localhost") {
      const proto = "https";
      const hdrs = await headers();
      const hostHeader = hdrs.get("host") || "";
      const port = hostHeader.includes(":") ? `:${hostHeader.split(":")[1]}` : "";
      redirect(`${proto}://${session.user.companySlug}.${host}${port}/profile`);
    }
  }

  if (session) {
    redirect("/profile");
  }

  return <LandingPage />;
}
