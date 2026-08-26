import pdf from "pdf-parse";
import { promises as fs } from "fs";
import path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-3.6-flash";

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
  jobDescription: string,
  requiredSkills: string[],
  requiredExperienceYears: number | null,
): Promise<AtsScoreResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const skillsList = requiredSkills.length > 0
    ? requiredSkills.join(", ")
    : "Not specified";

  const expRequirement = requiredExperienceYears != null && requiredExperienceYears > 0
    ? `${requiredExperienceYears} years`
    : "Not specified";

  const prompt = `Rate this resume 0-100 for the job. Be brief.

Job: ${jobDescription || "Not provided"}
Skills: ${skillsList}
Experience: ${expRequirement}

Resume: ${resumeText.substring(0, 4000)}

Return JSON: {"score":0-100,"reason":"brief","matchedSkills":[""],"missingSkills":[""]}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
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
    throw new Error("Failed to parse Gemini response as JSON.");
  }
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));

  return {
    score,
    reason: String(parsed.reason || ""),
    matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.map(String) : [],
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.map(String) : [],
  };
}
