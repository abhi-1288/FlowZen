"use client";
import dynamic from "next/dynamic";

export const ProfileClient = dynamic(
  () => import("@/components/profile/profile-hub").then((mod) => mod.ProfileHub),
  { ssr: false }
);
