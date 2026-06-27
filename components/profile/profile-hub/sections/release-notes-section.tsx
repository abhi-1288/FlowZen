import { VersionPanel } from "@/components/version/version-panel";
import { SectionHeader } from "../shared";

export function ReleaseNotesSection() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Release Notes" description="Version, last update, and recent changes." accent="slate" />
      <VersionPanel />
    </section>
  );
}
