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
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Company & Team" description="Organizational structure" accent="emerald" />
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Company" value={company?.name ? String(company.name) : undefined} />
        <Row label="Team" value={team?.name ? String(team.name) : undefined} />
        <Row label="Company status" value={profile?.companyStatus ? String(profile.companyStatus) : undefined} />
        <Row label="Team status" value={profile?.teamStatus ? String(profile.teamStatus) : undefined} />
        <Row label="Company Start Date" value={company?.startDate || company?.createdAt ? new Date((company.startDate || company.createdAt) as string | Date).toLocaleDateString() : undefined} />
        <Row label="Company Joined" value={profile?.company && profile?.companyJoined ? new Date(profile.companyJoined as string | Date).toLocaleDateString() : undefined} />
        <Row label="Team Joined" value={profile?.team && profile?.teamJoined ? new Date(profile.teamJoined as string | Date).toLocaleDateString() : undefined} />
        {inApprovedCompany && !["human-resource", "admin"].includes(role) ? (
          <Row label={joinedBy?.viaHr ? "Joined By HR" : "Company approved by"} value={joinedBy?.name ? String(joinedBy.name) : undefined} />
        ) : null}
      </dl>
      {profile?.companyStatus === "approved" && !profile?.companyIdentityCode ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">No unique company identity code has been issued yet.</p>
          <button
            className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
