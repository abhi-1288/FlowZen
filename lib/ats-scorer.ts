import pdf from "pdf-parse/lib/pdf-parse.js";
import { promises as fs } from "fs";
import path from "path";
import {
  ATS_ENV_FALLBACK_PROVIDERS,
  ATS_PROVIDERS,
  isAtsProvider,
  providerLabel,
  type AtsProvider,
} from "./ats-providers";

export const DEFAULT_OPENROUTER_MODEL = ATS_PROVIDERS.openrouter.defaultModel;
export const DEFAULT_GEMINI_MODEL = ATS_PROVIDERS.gemini.defaultModel;
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

export type { AtsProvider };

export type AtsScoreResult = {
  score: number;
  reason: string;
  matchedSkills: string[];
  missingSkills: string[];
};

export type AtsModelConfig = {
  provider: AtsProvider;
  apiKey: string;
  model: string;
  fallbackModel?: string;
  /** Chat-completions base URL. Only used with OpenAI-compatible providers; required for the `other` provider. */
  baseUrl?: string;
};

type CompanyAtsLike = {
  atsProvider?: string | null;
  atsModelApiKey?: string | null;
  atsModelName?: string | null;
  atsBaseUrl?: string | null;
} | null;

/** First present server env key among a provider's candidates. */
function envKeyFor(provider: AtsProvider): string {
  for (const envVar of ATS_PROVIDERS[provider]?.envKeyVars ?? []) {
    const value = process.env[envVar];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Builds the runtime config for one provider. `companyModel` is the
 * company-stored override (blank = provider default); historical env model
 * overrides for openrouter/gemini keep working.
 */
function providerConfig(
  provider: AtsProvider,
  apiKey: string,
  companyModel: string,
  companyBaseUrl: string,
): AtsModelConfig {
  if (provider === "gemini") {
    return {
      provider,
      apiKey,
      model: companyModel || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      fallbackModel: process.env.GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_FALLBACK_MODEL,
    };
  }

  const baseUrl =
    provider === "other" ? companyBaseUrl : ATS_PROVIDERS[provider]?.baseUrl || "";
  const model =
    companyModel ||
    (provider === "openrouter" ? process.env.OPENROUTER_MODEL : "") ||
    ATS_PROVIDERS[provider]?.defaultModel ||
    "";

  return { provider, apiKey, model, baseUrl };
}

/**
 * Resolves which provider/model/key to score with.
 *
 * Precedence: the company's stored setting wins (the `other` provider also
 * needs a stored base URL); otherwise fall back to the first free-tier server
 * env key; finally default to OpenRouter so the free router is attempted.
 */
export function resolveAtsModelConfig(company: CompanyAtsLike): AtsModelConfig {
  const storedProvider = String(company?.atsProvider ?? "").trim();
  const companyKey = String(company?.atsModelApiKey ?? "").trim();
  const companyModel = String(company?.atsModelName ?? "").trim();
  const companyBaseUrl = String(company?.atsBaseUrl ?? "").trim();

  if (isAtsProvider(storedProvider)) {
    // The custom provider is only usable once a base URL exists; until then
    // treat it as unset so the resolver falls back below.
    if (storedProvider !== "other" || companyBaseUrl) {
      return providerConfig(
        storedProvider,
        companyKey || envKeyFor(storedProvider),
        companyModel,
        companyBaseUrl,
      );
    }
  }

  for (const provider of ATS_ENV_FALLBACK_PROVIDERS) {
    const envKey = envKeyFor(provider);
    if (envKey) return providerConfig(provider, envKey, "", "");
  }

  return providerConfig("openrouter", "", "", "");
}

export async function extractResumeText(resumeUrl: string): Promise<string> {
  let buffer: Buffer;

  if (resumeUrl.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", resumeUrl);
    buffer = await fs.readFile(filePath);
  } else {
    const response = await fetch(resumeUrl);
    if (!response.ok) throw new Error(`Failed to fetch resume: ${response.status}`);
    const arrayBuf = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuf);
  }

  const data = await pdf(buffer);
  return data.text || "";
}

function buildPrompt(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  requiredSkills: string[],
  requiredExperienceYears: number | null,
  requiredExperienceMaxYears: number | null,
): string {
  const skillsList = requiredSkills.length > 0 ? requiredSkills.join(", ") : "Not specified";

  const expRequirement =
    requiredExperienceYears != null && requiredExperienceYears > 0
      ? requiredExperienceMaxYears != null && requiredExperienceMaxYears > requiredExperienceYears
        ? `${requiredExperienceYears}-${requiredExperienceMaxYears} years`
        : `${requiredExperienceYears} years`
      : "Not specified";

  const contextMissing = !jobDescription?.trim() && (!requiredSkills || requiredSkills.length === 0);

  return `Rate this resume 0-100 for the job. Be brief and strict.

Job Title: ${jobTitle || "Not provided"}
Job Description: ${jobDescription || "Not provided"}
Required Skills: ${skillsList}
Required Experience: ${expRequirement}

Resume: ${resumeText.substring(0, 4000)}

Scoring rules:
- Anchor the score strictly to the JOB TITLE and the required skills/description above.
- A candidate whose background is clearly unrelated to the role (for example, a software-engineering resume for an HR role) MUST score LOW (typically below 30).
${contextMissing ? "- No job description or required skills were provided. Judge ONLY on how relevant the candidate's experience, education, and skills are to the job title. Be conservative and do NOT inflate scores; if the resume does not clearly relate to the role, score it low." : "- Match the resume against the provided description and required skills. Reward matched skills and relevant experience; penalize missing or unrelated ones."}

Return ONLY a JSON object, no prose or markdown: {"score":0-100,"reason":"brief","matchedSkills":[""],"missingSkills":[""]}`;
}

/** Backs off on transient overload / rate-limit failures. */
async function postWithRetry(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  const res = await fetch(url, init);
  if ((res.status === 503 || res.status === 429 || res.status === 500) && attempt < 3) {
    const delayMs = [2000, 5000, 10000][attempt] ?? 10000;
    console.warn(`[ATS] ${res.status} from provider, retrying in ${delayMs}ms (attempt ${attempt + 1})`);
    await new Promise((r) => setTimeout(r, delayMs));
    return postWithRetry(url, init, attempt + 1);
  }
  return res;
}

/** Some models wrap JSON in prose or code fences despite the prompt. */
function extractJson(text: string): string {
  let t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  return t;
}

function normalizeResult(raw: string, provider: AtsProvider, finishReason: string | undefined): AtsScoreResult {
  let parsed: AtsScoreResult;
  try {
    parsed = JSON.parse(extractJson(raw)) as AtsScoreResult;
  } catch (e) {
    console.error("[ATS] JSON parse error:", e, "raw:", String(raw).substring(0, 500));
    throw new Error(`Failed to parse ${providerLabel(provider)} response as JSON (finishReason: ${finishReason || "unknown"}).`);
  }
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  return {
    score,
    reason: String(parsed.reason || ""),
    matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.map(String) : [],
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.map(String) : [],
  };
}

async function scoreResumeWithGemini(
  prompt: string,
  apiKey: string,
  model: string,
  fallbackModel: string | undefined,
): Promise<AtsScoreResult> {
  const callGemini = async (callModel: string): Promise<Response> =>
    postWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${callModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingLevel: "low" },
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                score: { type: "number" },
                reason: { type: "string" },
                matchedSkills: { type: "array", items: { type: "string" } },
                missingSkills: { type: "array", items: { type: "string" } },
              },
              required: ["score", "reason", "matchedSkills", "missingSkills"],
            },
          },
        }),
      },
    );

  let response = await callGemini(model);
  const fallbackStatuses = [503, 429, 500, 404, 400];
  if (!response.ok && fallbackModel && fallbackModel !== model && fallbackStatuses.includes(response.status)) {
    console.warn(`[ATS] Primary Gemini model ${model} unavailable, falling back to ${fallbackModel}`);
    response = await callGemini(fallbackModel);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const finishReason = data?.candidates?.[0]?.finishReason;
  console.log("[ATS] Gemini finishReason:", finishReason, "| length:", text.length);
  return normalizeResult(text, "gemini", finishReason);
}

/**
 * Generic scorer for every OpenAI-compatible endpoint (OpenRouter, Groq,
 * NVIDIA, Hugging Face, Mistral, Cohere, OpenAI, Anthropic compat, or a
 * custom URL from the `other` provider).
 */
async function scoreResumeWithOpenAICompatible(config: AtsModelConfig, prompt: string): Promise<AtsScoreResult> {
  const provider = config.provider;
  const baseUrl = (config.baseUrl || ATS_PROVIDERS[provider]?.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error(`${providerLabel(provider)} provider requires a base URL.`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (provider === "openrouter") {
    if (process.env.NEXT_PUBLIC_APP_URL) headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.PROJECT_NAME) headers["X-Title"] = process.env.PROJECT_NAME;
  }
  if (provider === "anthropic") headers["anthropic-version"] = "2023-06-01";

  const call = (withJsonMode: boolean): Promise<Response> =>
    postWithRetry(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2048,
        ...(withJsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  // Not every free model accepts `response_format`; retry once without it.
  let response = await call(true);
  if (
    (response.status === 400 || response.status === 422) &&
    !(provider === "openrouter" && config.model === DEFAULT_OPENROUTER_MODEL)
  ) {
    const detail = await response.text();
    console.warn(`[ATS] ${providerLabel(provider)} ${response.status} on ${config.model}, retrying without response_format: ${detail.slice(0, 200)}`);
    response = await call(false);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${providerLabel(provider)} API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const finishReason = data?.choices?.[0]?.finish_reason;
  console.log(`[ATS] ${providerLabel(provider)} finishReason:`, finishReason, "| length:", text.length);
  return normalizeResult(text, provider, finishReason);
}

/**
 * Scores a resume with the configured provider. `config` comes from
 * `resolveAtsModelConfig`; the caller is responsible for ensuring `apiKey` is
 * present so the failure message can be actionable.
 */
export async function scoreResume(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  requiredSkills: string[],
  requiredExperienceYears: number | null,
  requiredExperienceMaxYears: number | null,
  config: AtsModelConfig,
): Promise<AtsScoreResult> {
  if (!config.apiKey) {
    throw new Error(`No ${providerLabel(config.provider)} API key configured.`);
  }
  if (config.provider === "other" && !config.baseUrl) {
    throw new Error(`The custom ${providerLabel(config.provider)} provider has no Base URL configured.`);
  }
  if (config.provider === "other" && !config.model.trim()) {
    throw new Error(`The custom ${providerLabel(config.provider)} provider has no model name set.`);
  }

  const prompt = buildPrompt(
    resumeText,
    jobTitle,
    jobDescription,
    requiredSkills,
    requiredExperienceYears,
    requiredExperienceMaxYears,
  );

  if (config.provider === "gemini") {
    return scoreResumeWithGemini(prompt, config.apiKey, config.model, config.fallbackModel);
  }
  return scoreResumeWithOpenAICompatible(config, prompt);
}
