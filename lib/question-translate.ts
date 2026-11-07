import crypto from "crypto";
import { Company } from "@/models/Company";
import { resolveAtsModelConfig, type AtsModelConfig } from "./ats-scorer";
import { ATS_PROVIDERS, providerLabel } from "./ats-providers";
import { questionLanguageName } from "./question-languages";

/**
 * On-demand translation of one assessment question (text + options in order)
 * using the same provider the company configured for ATS scoring.
 *
 * Design notes:
 *  - The prompt forbids answering or explaining: the model is a translator,
 *    nothing else. Being an exam paper, a "helpful" model that solves the MCQ
 *    would effectively leak the answer, so the JSON schema carries only the
 *    translated text.
 *  - Option order is contractual: answers are graded BY OPTION POSITION, so the
 *    caller validates the returned array length and refuses a translation that
 *    drifted (merging or dropping options is never accepted).
 *  - A small TTL cache sits in front of the provider: the same question from the
 *    same job bank requested again (another candidate, a reload, a second
 *    attempt) costs nothing and comes back instantly.
 */

export type QuestionTranslation = { text: string; options: string[] };

export type TranslateInput = {
  language: string;
  /** Source question text, ≤ 1000 chars (the bank's own limit). */
  text: string;
  /** Source options, each ≤ 500 chars. */
  options: string[];
  config: AtsModelConfig;
};

// A translation is safe to reuse for a session-scale period; the cache is
// best-effort warm-up for the exam, not a durable store (serverless cold-starts
// rebuild it naturally).
const TRANSLATION_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 3000;

const cache = new Map<string, { at: number; value: QuestionTranslation }>();

function cacheKey(input: { language: string; text: string; options: string[] }): string {
  return crypto
    .createHash("sha256")
    .update([input.language, input.text, input.options.join("\u001f")].join("\u001e"))
    .digest("hex");
}

function cachedGet(key: string): QuestionTranslation | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TRANSLATION_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cachedSet(key: string, value: QuestionTranslation): void {
  if (cache.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.at > TRANSLATION_TTL_MS) cache.delete(k);
    }
    // Still full (steady traffic): drop the oldest entry.
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  }
  cache.set(key, { at: Date.now(), value });
}

function buildPrompt(input: { language: string; text: string; options: string[] }): string {
  const name = questionLanguageName(input.language) || input.language;
  return `Translate this exam question into ${name} VERBATIM. Do NOT answer it, solve it, summarise it, or add any commentary.

Rules:
- Translate the question text exactly as written. Keep universal tokens as-is: URLs, code, file names, numbers, and standard technical acronyms (e.g. HTTP, SQL).
- Translate every option, keeping the EXACT same number of options, in the original order. Never merge, split, add or drop options.
- If the question has no options, return an empty options array.
- If the question is already in ${name}, return it unchanged.

Return ONLY a JSON object, no prose or markdown:
{"text":"<translated question>","options":["<translated option 1>","..."]}

QUESTION:
${input.text}

OPTIONS:
${input.options.map((o, i) => `${i + 1}. ${o}`).join("\n") || "(no options)"}`;
}

async function postWithRetry(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  const res = await fetch(url, init);
  if ((res.status === 503 || res.status === 429 || res.status === 500) && attempt < 3) {
    const delayMs = [2000, 5000, 10000][attempt] ?? 10000;
    console.warn(`[Translate] ${res.status} from provider, retrying in ${delayMs}ms (attempt ${attempt + 1})`);
    await new Promise((r) => setTimeout(r, delayMs));
    return postWithRetry(url, init, attempt + 1);
  }
  return res;
}

/** Some models wrap JSON in prose or code fences despite the prompt. */
function extractJson(text: string): any {
  let t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

async function translateWithGemini(
  input: TranslateInput,
  prompt: string,
  model: string,
): Promise<QuestionTranslation> {
  const response = await postWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${input.config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingLevel: "low" },
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              text: { type: "string" },
              options: { type: "array", items: { type: "string" } },
            },
            required: ["text", "options"],
          },
        },
      }),
    },
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return extractJson(raw);
}

async function translateWithOpenAICompatible(
  config: AtsModelConfig,
  prompt: string,
): Promise<QuestionTranslation> {
  const baseUrl = (config.baseUrl || ATS_PROVIDERS[config.provider]?.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error(`${providerLabel(config.provider)} provider requires a base URL.`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (config.provider === "openrouter") {
    if (process.env.NEXT_PUBLIC_APP_URL) headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.PROJECT_NAME) headers["X-Title"] = process.env.PROJECT_NAME;
  }
  if (config.provider === "anthropic") headers["anthropic-version"] = "2023-06-01";

  const call = (withJsonMode: boolean): Promise<Response> =>
    postWithRetry(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 4096,
        ...(withJsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  // Not every free model accepts `response_format`; retry once without it.
  let response = await call(true);
  if (response.status === 400 || response.status === 422) {
    const detail = await response.text();
    console.warn(`[Translate] ${providerLabel(config.provider)} ${response.status} on ${config.model}, retrying without response_format: ${detail.slice(0, 200)}`);
    response = await call(false);
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${providerLabel(config.provider)} API error: ${response.status} - ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  return extractJson(data?.choices?.[0]?.message?.content || "");
}

/**
 * Which provider/model/key to translate with, from the company's stored ATS AI
 * setting (same precedence as resume scoring), so no extra vendor/key is needed.
 */
export function resolveTranslateModelConfig(company: any): AtsModelConfig {
  return resolveAtsModelConfig(
    company
      ? {
          atsProvider: company.atsProvider,
          atsModelApiKey: company.atsModelApiKey,
          atsModelName: company.atsModelName,
          atsBaseUrl: company.atsBaseUrl,
        }
      : null,
  );
}

/** True when the resolved config actually has a usable key — callers surface a nicer message otherwise. */
export function isTranslateConfigured(config: AtsModelConfig): boolean {
  return Boolean(config.apiKey) && !(config.provider === "other" && (!config.baseUrl || !config.model?.trim()));
}

/**
 * Translate one question (cache-first). Throws on provider/validation failure —
 * the route maps that to an actionable message. Never resolves "soft": a bad
 * translation contract (option count drift) is an error, not a degraded success.
 */
export async function translateQuestionContent(input: TranslateInput): Promise<QuestionTranslation> {
  const key = cacheKey(input);
  const hit = cachedGet(key);
  if (hit) return hit;

  if (!isTranslateConfigured(input.config)) {
    throw new Error("No AI provider key is configured, so translations are unavailable.");
  }

  const prompt = buildPrompt(input);
  const result: QuestionTranslation =
    input.config.provider === "gemini"
      ? await translateWithGemini(input, prompt, input.config.model)
      : await translateWithOpenAICompatible(input.config, prompt);

  // Contract check: the model gave the question back and kept option order.
  const text = String(result?.text ?? "").trim();
  const options = Array.isArray(result?.options) ? result.options.map((o: any) => String(o ?? "")) : null;
  if (!text) throw new Error("The translation came back empty. Try again in a moment.");
  if (options === null || options.length !== input.options.length) {
    throw new Error("The translation did not keep the answer options intact, so it was not applied.");
  }

  const value: QuestionTranslation = { text, options };
  cachedSet(key, value);
  return value;
}
