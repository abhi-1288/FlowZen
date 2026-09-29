import type { AnyRecord } from "../shared";
import { Row, SectionHeader } from "../shared";
import {
  isLegacyMainOfficeLabel,
  isMainOfficeLabel,
  mainOfficeLabelOf,
  regionEntryForMember,
} from "@/lib/company-regions";

export function CompanyTeamSection({
  profile,
  company,
  team,
  inApprovedCompany,
  role,
  identityRequesting,
  insights,
  onRequestIdentity,
}: {
  profile: AnyRecord | null;
  company: AnyRecord | null;
  team: AnyRecord | null;
  inApprovedCompany: boolean;
  role: string;
  identityRequesting: boolean;
  insights: AnyRecord | null;
  onRequestIdentity: () => Promise<void>;
}) {
  const joinedBy = (insights?.joinedBy as AnyRecord | undefined) ?? null;
  // Resolve the region the same way the rest of the app does, but treat a
  // stored "Main Office" as the legacy placeholder it is when the office has
  // since been given a real name — otherwise this section would look up an
  // address that does not exist and drop the region's HR/admin head.
  const ownRegionLabel = String(profile?.regionLabel ?? "").trim();
  const regionLabelText =
    ownRegionLabel && !isLegacyMainOfficeLabel(company, ownRegionLabel)
      ? ownRegionLabel
      : mainOfficeLabelOf(company);
  const regionAddress = regionEntryForMember(company, profile) as AnyRecord | null;
  const regionAddrText = regionAddress
    ? [String(regionAddress.line1 ?? ""), String(regionAddress.city ?? ""), String(regionAddress.state ?? "")].filter(Boolean).join(", ")
    : "";
  const isMainOffice = isMainOfficeLabel(company, regionLabelText);
  const alreadyLabelledMainOffice = regionLabelText.trim().toLowerCase() === "main office";
  const suffixMainOffice = isMainOffice && !alreadyLabelledMainOffice;
  const regionDisplay = regionLabelText
    ? regionAddrText
      ? `${regionLabelText} — ${regionAddrText}${suffixMainOffice ? " (Main Office)" : ""}`
      : `${regionLabelText}${suffixMainOffice ? " (Main Office)" : ""}`
    : undefined;

  const regionHrHead = regionAddress ? String(regionAddress.hrHead ?? "") : "";
  const regionAdminHead = regionAddress ? String(regionAddress.adminHead ?? "") : "";
  // Names resolved server-side for the viewer's own region. `insights.hr` is
  // only populated for HR/finance/admin/security, so without this a manager or
  // employee would fall through to a raw ObjectId fragment.
  const regionHeads = (insights?.regionHeads as AnyRecord | undefined) ?? null;
  const memberNameById = new Map<string, string>();
  const hrMembers = Array.isArray((insights?.hr as AnyRecord | undefined)?.members)
    ? ((insights?.hr as AnyRecord).members as AnyRecord[])
    : [];
  for (const m of hrMembers) {
    if (m) memberNameById.set(String(m?._id ?? m?.id ?? ""), String(m?.name ?? ""));
  }
  const headName = (id: string, key: "hrHead" | "adminHead") => {
    if (!id) return "";
    const resolved = regionHeads?.[key] as AnyRecord | undefined;
    if (resolved) return String(resolved.name ?? "");
    const fromMembers = memberNameById.get(id);
    if (fromMembers) return fromMembers;
    return "Assigned";
  };
  const hasRegionHeads = Boolean(regionHrHead || regionAdminHead);

  // After a disconnect the member has no company, no team and no join dates, so
  // the organizational rows below would all read "Not set" / "none". Swap them
  // for the employment they actually finished.
  const previous = (profile?.previousEmployment as AnyRecord | undefined) ?? null;
  const humanize = (value: unknown) => {
    const text = String(value ?? "").replace(/-/g, " ").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  };
  const fmtDate = (value: unknown) => {
    if (!value) return "";
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  const previousStart = fmtDate(previous?.joined);
  const previousEnd = fmtDate(previous?.ended);
  const previousPeriod = previousStart
    ? `${previousStart} — ${previousEnd}`
    : previousEnd || undefined;

  if (!inApprovedCompany && previous?.companyName) {
    return (
      <section className="rounded-xl neu-card p-5 dark:bg-[#000000] dark:border-zinc-800">
        <SectionHeader
          title="Previous Employment"
          description="Employment you have completed"
          accent="emerald"
        />
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Company" value={String(previous.companyName)} />
          <Row label="Region" value={String(previous.region ?? "") || undefined} />
          <Row label="Role" value={humanize(previous.role) || undefined} />
          <Row
            label="Employment Type"
            value={String(previous.employmentType ?? "").trim() || "Not set"}
          />
          <Row label="Employment Period" value={previousPeriod} />
          <Row label="Status" value="Employment ended" />
        </dl>
      </section>
    );
  }

  return (
    <section className="rounded-xl neu-card p-5 dark:bg-[#000000] dark:border-zinc-800">
      <SectionHeader title="Company & Team" description="Organizational structure" accent="emerald" />
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Company" value={company?.name ? String(company.name) : undefined} />
        <Row label="Team" value={team?.name ? String(team.name) : undefined} />
        <Row label="Company status" value={profile?.companyStatus ? String(profile.companyStatus) : undefined} />
        <Row label="Team status" value={profile?.teamStatus ? String(profile.teamStatus) : undefined} />
        <Row label="Company Start Date" value={company?.startDate || company?.createdAt ? new Date((company.startDate || company.createdAt) as string | Date).toLocaleDateString() : undefined} />
        <Row label="Company Joined" value={profile?.company && profile?.companyJoined ? new Date(profile.companyJoined as string | Date).toLocaleDateString() : undefined} />
        <Row label="Team Joined" value={profile?.team && profile?.teamJoined ? new Date(profile.teamJoined as string | Date).toLocaleDateString() : undefined} />
        <Row label="Region" value={regionDisplay} />
        <Row label="Region status" value={regionAddress?.status ? String(regionAddress.status) : undefined} />
        <Row label="Region HR Head" value={regionHrHead ? headName(regionHrHead, "hrHead") : "Not assigned"} />
        <Row label="Region Admin Head" value={regionAdminHead ? headName(regionAdminHead, "adminHead") : "Not assigned"} />
    
        {inApprovedCompany && !["human-resource", "admin"].includes(role) ? (
          <Row label={joinedBy?.viaHr ? "Joined By HR" : "Company approved by"} value={joinedBy?.name ? String(joinedBy.name) : undefined} />
        ) : null}
      </dl>
      {profile?.companyStatus === "approved" && !profile?.companyIdentityCode ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">No unique company identity code has been issued yet.</p>
          <button
            className="neu-btn neu-btn-primary mt-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed"
            disabled={identityRequesting || Boolean(insights?.pendingIdentityCodeRequest)}
            onClick={onRequestIdentity}
            type="button"
          >
            {insights?.pendingIdentityCodeRequest ? "Identity request pending" : identityRequesting ? "Requesting..." : "Ask unique identity from HR"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
