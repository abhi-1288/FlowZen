import { ProfileHub } from "@/components/profile/profile-hub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return <ProfileHub />;
}
