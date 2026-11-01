import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdSlot from "@/components/ads/ad-slot";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ItLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return (
    <>
      {children}
      <AdSlot
        placement="it"
        variant="banner"
        className="mx-auto max-w-4xl px-4 pb-10"
      />
    </>
  );
}
