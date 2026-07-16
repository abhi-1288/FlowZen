import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RecruitmentSidebar } from "@/components/recruitment/recruitment-sidebar";
import { RecruitmentSSEListener } from "@/components/recruitment/recruitment-sse-listener";

export default async function RecruitmentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = session.user.role ?? "";
  const isSeniorSecurity = role === "security" && Boolean((session.user as any)?.isSeniorSecurity);
  if (!["admin", "human-resource", "project-manager", "qa-tester", "finance"].includes(role) && !isSeniorSecurity) redirect("/profile");

  return (
    <div className="flex min-h-screen bg-app text-base">
      <RecruitmentSSEListener />
      <RecruitmentSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-app">
        {children}
      </main>
    </div>
  );
}
