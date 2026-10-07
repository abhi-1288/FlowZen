import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";
import { StoreCartProvider } from "@/components/store/cart-context";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return <StoreCartProvider>{children}</StoreCartProvider>;
}
