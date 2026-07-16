import type { AnyRecord } from "../shared";
import { Row, SectionHeader } from "../shared";

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
  const multiOffice = Boolean(company?.multiOffice);
  const companyAddresses = multiOffice && Array.isArray(company?.addresses)
    ? (company.addresses as AnyRecord[])
    : [];
  const regionLabel = profile?.regionLabel
    ? String(profile.regionLabel)
    : companyAddresses.length > 0 ? String(companyAddresses[0].label ?? "") : "";
  const regionAddress = regionLabel && companyAddresses.length > 0
    ? companyAddresses.find((a) => String(a.label ?? "") === regionLabel)
    : null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-[#000000] dark:border-zinc-800">
      <SectionHeader title="Company & Team" description="Organizational structure" accent="emerald" />
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Company" value={company?.name ? String(company.name) : undefined} />
        <Row label="Team" value={team?.name ? String(team.name) : undefined} />
        <Row label="Company status" value={profile?.companyStatus ? String(profile.companyStatus) : undefined} />
        <Row label="Team status" value={profile?.teamStatus ? String(profile.teamStatus) : undefined} />
        <Row label="Company Start Date" value={company?.startDate || company?.createdAt ? new Date((company.startDate || company.createdAt) as string | Date).toLocaleDateString() : undefined} />
        <Row label="Company Joined" value={profile?.company && profile?.companyJoined ? new Date(profile.companyJoined as string | Date).toLocaleDateString() : undefined} />
        <Row label="Team Joined" value={profile?.team && profile?.teamJoined ? new Date(profile.teamJoined as string | Date).toLocaleDateString() : undefined} />
        <Row label="Region" value={regionLabel
          ? regionAddress
            ? `${regionLabel} — ${[String(regionAddress.line1 ?? ""), String(regionAddress.city ?? ""), String(regionAddress.state ?? "")].filter(Boolean).join(", ")}`
            : regionLabel
          : undefined} />
        {inApprovedCompany && !["human-resource", "admin"].includes(role) ? (
          <Row label={joinedBy?.viaHr ? "Joined By HR" : "Company approved by"} value={joinedBy?.name ? String(joinedBy.name) : undefined} />
        ) : null}
      </dl>
      {profile?.companyStatus === "approved" && !profile?.companyIdentityCode ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">No unique company identity code has been issued yet.</p>
          <button
            className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
