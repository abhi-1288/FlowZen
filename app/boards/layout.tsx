import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DelegationSync } from "@/components/delegation-sync";

export default async function BoardsWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <>
      <DelegationSync />
      {children}
    </>
  );
}
