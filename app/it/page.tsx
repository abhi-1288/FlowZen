import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const IT_STAFF_ROLES = ["it-admin", "it-administration"];

export default async function ITPage() {
  const session = await getServerSession(authOptions);
  const role = String((session?.user as any)?.role ?? "");
  if (IT_STAFF_ROLES.includes(role)) {
    redirect("/it/board");
  }
  redirect("/it/tickets");
}
