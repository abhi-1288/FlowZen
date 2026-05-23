import { ProfileClient } from "./profile-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
