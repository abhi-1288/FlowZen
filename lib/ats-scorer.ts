import pdf from "pdf-parse/lib/pdf-parse.js";
import { promises as fs } from "fs";
import path from "path";

export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

export type AtsProvider = "openrouter" | "gemini";

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
};

type CompanyAtsLike = {
  atsProvider?: string | null;
  atsModelApiKey?: string | null;
  atsModelName?: string | null;
} | null;

/**
 * Resolves which provider/model/key to score with.
 *
 * Precedence: the company's stored setting wins; otherwise fall back to the
 * server env. When no provider is stored, prefer OpenRouter if its key is
 * present, then Gemini if its key is present, and finally OpenRouter so the
 * default free router is attempted.
 */
export function resolveAtsModelConfig(company: CompanyAtsLike): AtsModelConfig {
  const envOpenRouter = process.env.OPENROUTER_API_KEY || "";
  const envGemini = process.env.GEMINI_API_KEY || "";

  const storedProvider = String(company?.atsProvider ?? "").trim();
  const companyKey = String(company?.atsModelApiKey ?? "").trim();
  const companyModel = String(company?.atsModelName ?? "").trim();

  let provider: AtsProvider;
  if (storedProvider === "gemini" || storedProvider === "openrouter") {
    provider = storedProvider;
  } else if (envOpenRouter) {
    provider = "openrouter";
  } else if (envGemini) {
    provider = "gemini";
  } else {
    provider = "openrouter";
  }

  if (provider === "gemini") {
    return {
      provider,
      apiKey: companyKey || envGemini,
      model: companyModel || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      fallbackModel: process.env.GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_FALLBACK_MODEL,
    };
  }

  return {
    provider: "openrouter",
    apiKey: companyKey || envOpenRouter,
    model: companyModel || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
  };
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
    throw new Error(`Failed to parse ${provider} response as JSON (finishReason: ${finishReason || "unknown"}).`);
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

async function scoreResumeWithOpenRouter(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<AtsScoreResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (process.env.NEXT_PUBLIC_APP_URL) headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.PROJECT_NAME) headers["X-Title"] = process.env.PROJECT_NAME;

  const call = (withJsonMode: boolean): Promise<Response> =>
    postWithRetry("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2048,
        ...(withJsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  // Not every free model accepts `response_format`; retry once without it.
  let response = await call(true);
  if ((response.status === 400 || response.status === 422) && model !== "openrouter/free") {
    const detail = await response.text();
    console.warn(`[ATS] OpenRouter ${response.status} on ${model}, retrying without response_format: ${detail.slice(0, 200)}`);
    response = await call(false);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const finishReason = data?.choices?.[0]?.finish_reason;
  console.log("[ATS] OpenRouter finishReason:", finishReason, "| length:", text.length);
  return normalizeResult(text, "openrouter", finishReason);
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
    throw new Error(`No ${config.provider === "gemini" ? "Gemini" : "OpenRouter"} API key configured.`);
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
  return scoreResumeWithOpenRouter(prompt, config.apiKey, config.model);
}
