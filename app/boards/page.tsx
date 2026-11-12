import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Boards workspace",
  robots: { index: false, follow: false },
};

export default async function BoardsWorkspaceRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp ?? {})) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/board/workspace?${qs}` : "/board/workspace");
}
