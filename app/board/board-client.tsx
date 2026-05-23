"use client";
import dynamic from "next/dynamic";

export const BoardClient = dynamic(
  () => import("@/components/boards/board-shell").then((mod) => mod.BoardShell),
  { ssr: false }
);
