import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RecruitmentSidebar } from "@/components/recruitment/recruitment-sidebar";
import { RecruitmentSSEListener } from "@/components/recruitment/recruitment-sse-listener";

export default async function RecruitmentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = session.user.role ?? "";
  if (!["admin", "human-resource", "project-manager", "qa-tester", "finance"].includes(role)) redirect("/profile");

  return (
    <div className="flex min-h-screen bg-[#f7f8fb]">
      <RecruitmentSSEListener />
      <RecruitmentSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
