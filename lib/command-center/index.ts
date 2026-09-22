import { User } from "@/models/User";
import { buildAttention } from "./attention";
import type { CommandCenterContext } from "./context";
import { buildKpis } from "./kpis";
import { buildQuickActions } from "./quick-actions";
import { VARIANT_LABELS, resolveVariant } from "./roles";
import { buildTrends } from "./trends";
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

type PopulatedCompany = { _id: unknown; name?: string; primaryColor?: string };

export async function buildCommandCenter(opts: {
  userId: string;
  period: Period;
}): Promise<CommandCenterResponse> {
  const cacheKey = `${opts.userId}:${opts.period}`;
  return cachedOrBuild(cacheKey, async () => {
    const user = await User.findById(opts.userId).populate<{ company: PopulatedCompany | null }>(
      "company",
      "name primaryColor",
    );
    if (!user) throw new Error("User not found.");

    const companyRaw = user.company;
    const companyId = companyRaw ? String(companyRaw._id ?? "") : null;
    const companyName = String(companyRaw?.name ?? "");

    const role = String(user.role ?? "employee");
    const isSeniorSecurity = Boolean((user as { isSeniorSecurity?: boolean }).isSeniorSecurity);
    const variant = resolveVariant(role);

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
      variantLabel: VARIANT_LABELS[variant],
      companyName,
      companyColor: ctx.companyColor,
      role,
      userName: ctx.userName,
      kpis,
      trends,
      projectHealth,
      attention,
      upcoming,
      quickActions,
    };
  }, Date.now());
}