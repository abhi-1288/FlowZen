import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { resolveAtsModelConfig } from "@/lib/ats-scorer";
import { ATS_PROVIDER_LIST, isAtsProvider, type AtsProvider } from "@/lib/ats-providers";

/** Never return the raw key — the UI only ever sees this shape. */
function maskApiKey(key: string): string {
  const value = String(key ?? "").trim();
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 7)}${"•".repeat(Math.min(12, Math.max(4, value.length - 11)))}${value.slice(-4)}`;
}

function normalizeProvider(raw: unknown): AtsProvider | null {
  const value = String(raw ?? "").trim();
  return isAtsProvider(value) ? value : null;
}

/** Strips trailing slashes and enforces HTTPS on a custom base URL. */
function normalizeBaseUrl(raw: string): { url: string } | { error: string } {
  const value = raw.replace(/\/+$/, "");
  if (!value) return { url: "" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: "Base URL must be a valid URL (e.g. https://api.example.com/v1)." };
  }
  if (url.protocol !== "https:") return { error: "Base URL must use HTTPS." };
  if (value.length > 300) return { error: "Base URL must be 300 characters or fewer." };
  return { url: value };
}

/**
 * Uses the same resolver the scorer uses, so the provider shown in the UI is
 * the one that will actually run — including falling back to the provider whose
 * env key is present when the company has not chosen one.
 */
function serializeSettings(company: Record<string, unknown> | null) {
  const resolved = resolveAtsModelConfig(company as any);
  const companyKey = String(company?.atsModelApiKey ?? "").trim();
  return {
    provider: resolved.provider,
    model: String(company?.atsModelName ?? ""),
    baseUrl: String(company?.atsBaseUrl ?? ""),
    hasApiKey: Boolean(resolved.apiKey),
    maskedApiKey: companyKey ? maskApiKey(companyKey) : resolved.apiKey ? "(from server environment)" : "",
    defaults: Object.fromEntries(ATS_PROVIDER_LIST.map((meta) => [meta.id, meta.defaultModel])),
  };
}

async function loadActor() {
  const userId = await requireUserId();
  if (!userId) return { error: jsonError("Unauthorized", 401) } as const;

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return { error: dbError } as const;
    throw error;
  }

  const user = await User.findById(userId).select("role company");
  if (!user || !["admin", "human-resource"].includes(String(user.role))) {
    return { error: jsonError("Forbidden", 403) } as const;
  }
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return { error: hq.response } as const;
  return { user } as const;
}

export async function GET() {
  const actor = await loadActor();
  if ("error" in actor) return actor.error;

  const company = await Company.findById(actor.user.company)
    .select("atsProvider atsModelApiKey atsModelName atsBaseUrl")
    .lean();
  if (!company) return jsonError("Company not found.", 404);

  return NextResponse.json(serializeSettings(company as Record<string, unknown>));
}

export async function PATCH(request: Request) {
  const actor = await loadActor();
  if ("error" in actor) return actor.error;

  const company = await Company.findById(actor.user.company);
  if (!company) return jsonError("Company not found.", 404);

  const body = await request.json().catch(() => ({}));

  if (Object.prototype.hasOwnProperty.call(body, "provider")) {
    const provider = normalizeProvider((body as any).provider);
    if (!provider) {
      return jsonError(
        `Provider must be one of: ${ATS_PROVIDER_LIST.map((meta) => meta.id).join(", ")}.`,
        400,
      );
    }
    (company as any).atsProvider = provider;
  }

  if (Object.prototype.hasOwnProperty.call(body, "model")) {
    const model = String((body as any).model ?? "").trim();
    if (model.length > 120) return jsonError("Model name must be 120 characters or fewer.", 400);
    if (/\s/.test(model)) return jsonError("Model name cannot contain spaces.", 400);
    (company as any).atsModelName = model;
  }

  if (Object.prototype.hasOwnProperty.call(body, "baseUrl")) {
    const normalized = normalizeBaseUrl(String((body as any).baseUrl ?? "").trim());
    if ("error" in normalized) return jsonError(normalized.error, 400);
    (company as any).atsBaseUrl = normalized.url;
  }

  if (Object.prototype.hasOwnProperty.call(body, "apiKey")) {
    const incoming = String((body as any).apiKey ?? "").trim();
    const current = String((company as any).atsModelApiKey ?? "");
    // Guard against the UI echoing the masked value back unchanged.
    if (incoming !== maskApiKey(current)) {
      (company as any).atsModelApiKey = incoming;
    }
  }

  await company.save();

  return NextResponse.json({
    ok: true,
    ...serializeSettings(company as unknown as Record<string, unknown>),
  });
}
