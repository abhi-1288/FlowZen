import pdf from "pdf-parse/lib/pdf-parse.js";
import { promises as fs } from "fs";
import path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";

export type AtsScoreResult = {
  score: number;
  reason: string;
  matchedSkills: string[];
  missingSkills: string[];
};

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

export async function scoreResumeWithGemini(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  requiredSkills: string[],
  requiredExperienceYears: number | null,
  requiredExperienceMaxYears: number | null = null,
): Promise<AtsScoreResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const skillsList = requiredSkills.length > 0
    ? requiredSkills.join(", ")
    : "Not specified";

  const expRequirement = requiredExperienceYears != null && requiredExperienceYears > 0
    ? requiredExperienceMaxYears != null && requiredExperienceMaxYears > requiredExperienceYears
      ? `${requiredExperienceYears}-${requiredExperienceMaxYears} years`
      : `${requiredExperienceYears} years`
    : "Not specified";

  const contextMissing = !jobDescription?.trim() && (!requiredSkills || requiredSkills.length === 0);

  const prompt = `Rate this resume 0-100 for the job. Be brief and strict.

Job Title: ${jobTitle || "Not provided"}
Job Description: ${jobDescription || "Not provided"}
Required Skills: ${skillsList}
Required Experience: ${expRequirement}

Resume: ${resumeText.substring(0, 4000)}

Scoring rules:
- Anchor the score strictly to the JOB TITLE and the required skills/description above.
- A candidate whose background is clearly unrelated to the role (for example, a software-engineering resume for an HR role) MUST score LOW (typically below 30).
${contextMissing ? "- No job description or required skills were provided. Judge ONLY on how relevant the candidate's experience, education, and skills are to the job title. Be conservative and do NOT inflate scores; if the resume does not clearly relate to the role, score it low." : "- Match the resume against the provided description and required skills. Reward matched skills and relevant experience; penalize missing or unrelated ones."}

Return JSON: {"score":0-100,"reason":"brief","matchedSkills":[""],"missingSkills":[""]}`;

  const callGemini = async (model: string, attempt = 0): Promise<Response> => {
    const u = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(u, {
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
    });

    // Retry transient overload / rate-limit failures with backoff.
    if ((res.status === 503 || res.status === 429 || res.status === 500) && attempt < 3) {
      const delayMs = [2000, 5000, 10000][attempt] ?? 10000;
      console.warn(`[ATS] Gemini ${res.status} on ${model}, retrying in ${delayMs}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, delayMs));
      return callGemini(model, attempt + 1);
    }
    return res;
  };

  let response = await callGemini(GEMINI_MODEL);
  const fallbackStatuses = [503, 429, 500, 404, 400];
  if (!response.ok && GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL && fallbackStatuses.includes(response.status)) {
    console.warn(`[ATS] Primary model ${GEMINI_MODEL} unavailable, falling back to ${GEMINI_FALLBACK_MODEL}`);
    response = await callGemini(GEMINI_FALLBACK_MODEL);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const finishReason = data?.candidates?.[0]?.finishReason;
  console.log("[ATS] Gemini finishReason:", finishReason, "| length:", text.length);

  let parsed: AtsScoreResult;
  try {
    parsed = JSON.parse(text) as AtsScoreResult;
  } catch (e) {
    console.error("[ATS] JSON parse error:", e, "raw:", text.substring(0, 500));
    throw new Error(`Failed to parse Gemini response as JSON (finishReason: ${finishReason || "unknown"}).`);
  }
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));

  return {
    score,
    reason: String(parsed.reason || ""),
    matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.map(String) : [],
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.map(String) : [],
  };
}
