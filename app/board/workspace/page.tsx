import { BoardsWorkspaceClient } from "./workspace-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Boards workspace",
  robots: { index: false, follow: false },
};

export default function BoardWorkspacePage() {
  return <BoardsWorkspaceClient />;
}
