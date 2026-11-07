import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { Company } from "@/models/Company";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { checkRateLimit } from "@/lib/rate-limit";
import { isQuestionLanguage } from "@/lib/question-languages";
import {
  resolveTranslateModelConfig,
  translateQuestionContent,
} from "@/lib/question-translate";

/**
 * On-demand translation of one assessment question for the candidate sitting
 * it. Authenticated by the same portal token as the rest of the exam console.
 *
 * Why a separate endpoint (rather than folding into `/start`): the candidate
 * opts in per question, and translating up-front would burn tokens on every
 * paper view even for candidates who never use it. Keeping it lazy also means
 * a translation failure never blocks answering.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();
  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const limited = checkRateLimit(`qtranslate::${candidate._id}`, 60, 10 * 60 * 1000);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const language = String(body?.language ?? "").trim();
  if (!isQuestionLanguage(language)) return jsonError("Unsupported language.", 400);

  const text = String(body?.text ?? "");
  if (!text || text.length > 1000) return jsonError("Question text is missing or too long.", 400);

  const rawOptions = Array.isArray(body?.options) ? body.options : [];
  if (rawOptions.length > 20) return jsonError("Too many options.", 400);
  const options = rawOptions.map((o: unknown) => String(o ?? ""));
  if (options.some((o: string) => o.length > 500)) return jsonError("An option is too long.", 400);

  const company = await Company.findById(candidate.company)
    .select("atsProvider atsModelApiKey atsModelName atsBaseUrl")
    .lean();
  const config = resolveTranslateModelConfig(company);

  try {
    const translated = await translateQuestionContent({
      language,
      text,
      options,
      config,
    });
    return NextResponse.json(translated);
  } catch (err: any) {
    console.error("[translate] failed:", err?.message || err);
    return jsonError(err?.message || "Translation is unavailable right now. Please try again.", 500);
  }
}
