import { VersionPanel } from "@/components/version/version-panel";
import { SectionHeader } from "../shared";

export function ReleaseNotesSection() {
  return (
    <section className="rounded-xl neu-card p-5 dark:border-zinc-800 dark:bg-[#000000]">
      <SectionHeader title="Release Notes" description="Version, last update, and recent changes." accent="slate" />
      <VersionPanel />
    </section>
  );
}
