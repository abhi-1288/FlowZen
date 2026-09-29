import { User } from "@/models";
import { buildAttention } from "./attention";
import type { CommandCenterContext } from "./context";
import { buildKpis } from "./kpis";
import { buildQuickActions } from "./quick-actions";
import { resolveCommandCenterScope } from "./region";
import { labelFor, resolveVariant } from "./roles";
import { buildTrends, getCompanyBoardIds } from "./trends";
import { buildUpcoming } from "./upcoming";
import type { CommandCenterResponse, Period } from "./types";

const VALID_PERIODS: Period[] = ["7d", "30d", "3m", "1y"];

const CACHE_TTL_MS = 10_000;

const cache = new Map<string, { at: number; data: CommandCenterResponse }>();

function cachedOrBuild(
  key: string,
  build: () => Promise<CommandCenterResponse>,
  now: number,
): Promise<CommandCenterResponse> {
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.data);
  return build().then((data) => {
    cache.set(key, { at: Date.now(), data });
    if (cache.size > 200) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return data;
  });
}

export function parsePeriod(raw: string | null): Period {
  return VALID_PERIODS.includes(raw as Period) ? (raw as Period) : "7d";
}

type PopulatedCompany = {
  _id: unknown;
  name?: string;
  primaryColor?: string;
  owner?: unknown;
  addresses?: unknown;
  address?: string | null;
};

export async function buildCommandCenter(opts: {
  userId: string;
  period: Period;
  region?: string | null;
}): Promise<CommandCenterResponse> {
  // The region is part of the key, not just the user: a company owner or a
  // region head can switch regions, and without this the previous region's
  // numbers would be served back to them for the cache TTL.
  const cacheKey = `${opts.userId}:${opts.period}:${opts.region ?? ""}`;
  return cachedOrBuild(cacheKey, async () => {
    const user = await User.findById(opts.userId).populate<{ company: PopulatedCompany | null }>(
      "company",
      "name primaryColor owner addresses address",
    );
    if (!user) throw new Error("User not found.");

    const companyRaw = user.company;
    const companyId = companyRaw ? String(companyRaw._id ?? "") : null;
    const companyName = String(companyRaw?.name ?? "");

    const role = String(user.role ?? "employee");
    const isSeniorSecurity = Boolean((user as { isSeniorSecurity?: boolean }).isSeniorSecurity);
    const variant = resolveVariant(role);

    const scope = await resolveCommandCenterScope(
      companyRaw,
      { _id: user._id, company: user.company, regionLabel: user.regionLabel, role },
      variant,
      opts.region,
    );

    // Resolved once here rather than at each of the five call sites that used to
    // walk company -> members -> boards, and shared with every builder through
    // the context.
    const boardIds =
      variant === "personal" ? null : await getCompanyBoardIds(companyId, scope.memberIds);

    const ctx: CommandCenterContext = {
      userId: opts.userId,
      role,
      isSeniorSecurity,
      companyId,
      userName: String(user.name ?? "").trim() || "there",
      companyName,
      companyColor: String(companyRaw?.primaryColor ?? "#2563eb"),
      variant,
      period: opts.period,
      now: new Date(),
      region: scope.region,
      regionLabel: scope.regionLabel,
      regionScope: scope.regionScope,
      regionFallback: scope.regionFallback,
      regionForced: scope.regionForced,
      canSwitchRegion: scope.canSwitchRegion,
      allowGlobalRegion: scope.allowGlobalRegion,
      regionOptions: scope.regionOptions,
      memberIds: scope.memberIds,
      visibleMemberIds: scope.visibleMemberIds,
      isMainOffice: scope.isMainOffice,
      boardIds,
    };

    const [kpis, { trends, projectHealth }, attention, upcoming, quickActions] = await Promise.all([
      buildKpis(ctx),
      buildTrends(ctx),
      buildAttention(ctx),
      buildUpcoming(ctx),
      buildQuickActions(ctx),
    ]);

    return {
      variant,
      variantLabel: labelFor(variant, scope.regionScope === "region" ? scope.regionLabel : null),
      companyName,
      companyColor: ctx.companyColor,
      role,
      userName: ctx.userName,
      region: scope.region,
      regionLabel: scope.regionLabel,
      regionScope: scope.regionScope,
      regionFallback: scope.regionFallback,
      regionForced: scope.regionForced,
      canSwitchRegion: scope.canSwitchRegion,
      allowGlobalRegion: scope.allowGlobalRegion,
      regionOptions: scope.regionOptions,
      kpis,
      trends,
      projectHealth,
      attention,
      upcoming,
      quickActions,
    };
  }, Date.now());
}
