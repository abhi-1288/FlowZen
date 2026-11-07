/**
 * The fixed language list offered on every assessment / mock-test question.
 *
 * Deliberately a short, shared list rather than free text: it keeps LLM-derived
 * translations comparable, keeps the ring-select UI simple, and every entry is a
 * name both `label` (English) and `native` (its own script for on-screen UI)
 * — the native label is what candidates actually recognise.
 *
 * Imported by both client components and server routes, so it must stay free of
 * server-only imports.
 */
export const QUESTION_TRANSLATION_LANGUAGES = [
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "Urdu", native: "اردو" },
] as const;

export type QuestionLanguageCode = (typeof QUESTION_TRANSLATION_LANGUAGES)[number]["code"];

export function isQuestionLanguage(value: unknown): value is QuestionLanguageCode {
  return QUESTION_TRANSLATION_LANGUAGES.some((l) => l.code === value);
}

export function questionLanguageName(code: string): string {
  const found = QUESTION_TRANSLATION_LANGUAGES.find((l) => l.code === code);
  return found ? `${found.label} (${found.native})` : "";
}

/** Purely for display on the translate chip / ring UI. */
export function questionLanguageNative(code: string): string {
  return QUESTION_TRANSLATION_LANGUAGES.find((l) => l.code === code)?.native ?? "";
}
