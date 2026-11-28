import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DelegationSync } from "@/components/delegation-sync";
import { CrmSidebar } from "@/components/crm/crm-sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-app text-base">
      <DelegationSync />
      <CrmSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-app">
        {children}
      </main>
    </div>
  );
}