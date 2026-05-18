import { BoardShell } from "@/components/boards/board-shell";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ id: string }> };


export const metadata: Metadata = {
  title: "Board",
};

export default async function BoardPage({ params }: PageProps) {
  const { id } = await params;
  return <BoardShell boardId={id} />;
}
