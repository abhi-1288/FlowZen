"use client";
import dynamic from "next/dynamic";

export const BoardsWorkspaceClient = dynamic(
  () => import("@/components/boards/continuity-workspace").then((mod) => mod.ContinuityWorkspace),
  { ssr: false },
);
