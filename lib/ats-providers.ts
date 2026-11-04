/**
 * Central registry for ATS resume-scoring providers.
 *
 * Deliberately framework-neutral (no node-only imports) so both the server
 * scorer (lib/ats-scorer.ts) and the client UI (profile-hub) can consume it.
 *
 * Every provider except `gemini` speaks the OpenAI `/v1/chat/completions`
 * contract, so they all share one generic scoring implementation. Anthropic,
 * Cohere and Z.ai are reached through their OpenAI-compatibility endpoints
 * rather than native SDKs; `other` is any user-supplied OpenAI-compatible
 * endpoint stored in the company's `atsBaseUrl` field.
 *
 * Provider list and free tiers referenced from
 * https://github.com/mnfst/awesome-free-llm-apis
 */

export type AtsProvider =
  | "openrouter"
  | "gemini"
  | "openai"
  | "anthropic"
  | "huggingface"
  | "nvidia"
  | "groq"
  | "mistral"
  | "cohere"
  | "zai"
  | "other";

export type AtsProviderMeta = {
  id: AtsProvider;
  label: string;
  /** OpenAI-compatible chat-completions base URL. Empty for `gemini` (native API) and `other` (user-entered). */
  baseUrl: string;
  /** Suggested model; shown as the model input placeholder and used when the field is left blank. */
  defaultModel: string;
  /** Server env vars consulted for the fallback API key, in order. */
  envKeyVars: string[];
  /** Example key format shown in the API-key input. */
  keyPlaceholder: string;
  /** Short hint shown under the provider select. */
  note: string;
};

export const ATS_PROVIDER_LIST: AtsProviderMeta[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/free",
    envKeyVars: ["OPENROUTER_API_KEY"],
    keyPlaceholder: "sk-or-v1-...",
    note: "Free models via OpenRouter — the free router below handles ~50 requests/day (1,000 after a one-time $10 top-up).",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-120b",
    envKeyVars: ["GROQ_API_KEY"],
    keyPlaceholder: "gsk_...",
    note: "Free tier with ultra-fast inference (~1,000 requests/day). Key: console.groq.com/keys.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "",
    defaultModel: "gemini-3.5-flash",
    envKeyVars: ["GEMINI_API_KEY"],
    keyPlaceholder: "AIza...",
    note: "Google AI Studio API key (aistudio.google.com/app/apikey).",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    envKeyVars: ["OPENAI_API_KEY"],
    keyPlaceholder: "sk-...",
    note: "Paid platform key — needs billing enabled before scoring high volumes.",
  },
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-haiku-4-5",
    envKeyVars: ["ANTHROPIC_API_KEY"],
    keyPlaceholder: "sk-ant-...",
    note: "Paid Anthropic key, used through their OpenAI-compatible endpoint.",
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    baseUrl: "https://router.huggingface.co/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
    envKeyVars: ["HUGGINGFACE_API_KEY", "HF_TOKEN"],
    keyPlaceholder: "hf_...",
    note: "Inference Providers token (hf.co/settings/tokens). Includes a small free monthly allowance.",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "meta/llama-3.3-70b-instruct",
    envKeyVars: ["NVIDIA_API_KEY", "NVIDIA_NIM_API_KEY"],
    keyPlaceholder: "nvapi-...",
    note: "Free with NVIDIA Developer Program membership (build.nvidia.com). 100+ models, ~10,000 requests/day.",
  },
  {
    id: "mistral",
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    envKeyVars: ["MISTRAL_API_KEY"],
    keyPlaceholder: "",
    note: "Free mode is enabled by default on new accounts — no credit card needed (console.mistral.ai/api-keys).",
  },
  {
    id: "cohere",
    label: "Cohere",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    defaultModel: "command-a-03-2025",
    envKeyVars: ["COHERE_API_KEY"],
    keyPlaceholder: "",
    note: "Free trial key: 1,000 calls/month, non-commercial use (dashboard.cohere.com/api-keys).",
  },
  {
    id: "zai",
    label: "Z.ai (GLM)",
    baseUrl: "https://api.z.ai/api/paas/v4",
    defaultModel: "glm-4.7-flash",
    envKeyVars: ["ZAI_API_KEY", "ZHIPU_API_KEY"],
    keyPlaceholder: "",
    note: "Free GLM flash models via the international Z.ai endpoint (open.bigmodel.cn → API keys).",
  },
  {
    id: "other",
    label: "Other (custom endpoint)",
    baseUrl: "",
    defaultModel: "",
    envKeyVars: [],
    keyPlaceholder: "",
    note: "Any OpenAI-compatible endpoint — enter its Base URL below (e.g. https://api.llm7.io/v1, an OVHcloud endpoint, or a self-hosted vLLM/Ollama server).",
  },
];

export const ATS_PROVIDERS: Record<AtsProvider, AtsProviderMeta> =
  Object.fromEntries(ATS_PROVIDER_LIST.map((meta) => [meta.id, meta])) as Record<AtsProvider, AtsProviderMeta>;

export function isAtsProvider(value: unknown): value is AtsProvider {
  return ATS_PROVIDER_LIST.some((meta) => meta.id === value);
}

export function providerLabel(provider: AtsProvider): string {
  return ATS_PROVIDERS[provider]?.label ?? provider;
}

/** Models the env auto-fallback may select for companies that have not chosen one. Intentionally excludes paid providers (OpenAI, Anthropic). */
export const ATS_ENV_FALLBACK_PROVIDERS: AtsProvider[] = [
  "openrouter",
  "groq",
  "gemini",
  "mistral",
  "nvidia",
  "huggingface",
  "zai",
  "cohere",
];
