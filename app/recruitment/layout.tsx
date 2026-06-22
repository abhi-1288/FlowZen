import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RecruitmentSidebar } from "@/components/recruitment/recruitment-sidebar";

export default async function RecruitmentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "admin" && role !== "human-resource") redirect("/profile");

  return (
    <div className="flex min-h-screen bg-[#f7f8fb]">
      <RecruitmentSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
