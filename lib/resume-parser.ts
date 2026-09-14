import pdf from "pdf-parse/lib/pdf-parse.js";
import { promises as fs } from "fs";
import path from "path";

export type ParsedResume = {
  name: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  bloodGroup: string;
  emergencyContact: string;
  highestQualification: string;
  currentCompany: string;
  totalExperience: string;
  skills: string;
};

function normalizePhone(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  const digits = cleaned.replace(/[^+\d]/g, "");
  return /^\+?\d{7,15}$/.test(digits) ? digits : "";
}

function extractName(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line)) return line;
  }
  return "";
}

function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : "";
}

function extractPhone(text: string): string {
  const match = text.match(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,}/
  );
  return match ? match[0] : "";
}

function extractDOB(text: string): string {
  const patterns = [
    /(?:date\s*of\s*birth|dob|birth\s*date)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(?:date\s*of\s*birth|dob|birth\s*date)\s*:?\s*(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/i,
    /(?:born|birth)\s*(?:on|date)?\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function extractBloodGroup(text: string): string {
  const patterns = [
    /blood\s*(?:group|type)\s*:?\s*([A-Za-z]+[+\-]?)/i,
    /blood\s*:?\s*([A-Za-z]+[+\-]?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const bg = match[1].toUpperCase();
      if (/^(A|B|O|AB)[+-]$/.test(bg)) return bg;
    }
  }
  return "";
}

function extractAddress(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const addressKeywords = /address|residence/i;
  let capture = false;
  const parts: string[] = [];
  for (const line of lines) {
    if (addressKeywords.test(line)) {
      capture = true;
      const after = line
        .replace(/\b(?:current|permanent|correspondence|residential|mailing)\s+address\b|\baddress\b|\bresidence\b/gi, "")
        .replace(/^[\s:,\-–—|]+/, "");
      if (after && !/^(phone|mobile|email)/i.test(after)) parts.push(after);
      continue;
    }
    if (capture) {
      if (!line || /^(phone|mobile|email|date\s*of\s*birth|database|objective|summary|education|experience|skills?|technical|profile|linkedin|github)/i.test(line)) break;
      parts.push(line);
    }
  }
  const result = parts.join(", ").replace(/^[,.\s-]+|[,.\s-]+$/g, "");
  if (result) return result;

  // Fallback: a labelled address paragraph anywhere in the text.
  const match = text.match(/(?:current\s+address|permanent\s+address|correspondence\s+address|residential\s+address|address)\s*[:–—-]?\s*([^\n]+(?:\n[^\n]+){0,3})/i);
  if (match) {
    const block = match[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^(phone|mobile|email|date\s*of\s*birth|objective|summary|education|experience|skills?)\b/i.test(l))
      .join(", ")
      .replace(/^[,.\s]+|[,.\s]+$/g, "")
      .replace(/[,\s]+$/g, "");
    if (block && !/@/.test(block)) return block;
  }

  // Last resort: a standalone line that smells like an address (digits + words).
  for (const line of lines) {
    if (/\d{3,}/.test(line) && /\b(road|street|nagar|colony|society|layout|extension|city|town|district|state|pincode|pin\b)/i.test(line) && line.length < 120) {
      return line;
    }
  }
  return "";
}

function cleanCompanyName(value: string): string {
  const trimmed = value
    .trim()
    .replace(/[,\s.]+$/, "")
    .replace(/\s+(?:as|at|from|between|under|for)\b.*$/i, "")
    .trim();
  return trimmed.replace(/[,\s.]+$/, "").trim();
}

function extractCurrentCompany(text: string): string {
  const m1 = text.match(/(?:current\s+company|employer|organisation|organization)\s*[:–—-]?\s*([^\n]{2,70})/i);
  if (m1) {
    const company = cleanCompanyName(m1[1]);
    if (company && !/@/.test(company) && !/\b(reference|details|objective|summary)\b/i.test(company)) return company;
  }
  const m2 = text.match(/(?:worked|working|employed)\s+(?:as\s+[^.\n]{1,50}\s+)?at\s+([A-Za-z0-9][A-Za-z0-9&.]*(?:\s+[A-Za-z0-9&.]*){0,4})/i);
  if (m2) {
    const company = cleanCompanyName(m2[1]);
    if (company && !/@/.test(company)) return company;
  }
  return "";
}

function extractTotalExperience(text: string): string {
  const p1 = text.match(/(?:total\s+)?(?:work\s+)?experience\s*[:–—-]?\s*(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)/i);
  if (p1) return p1[1];
  const p2 = text.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|work\s+experience)/i);
  return p2 ? p2[1] : "";
}

function extractSkills(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const chunks: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^(?:technical\s*)?skills?\s*[:,\-]?/i.test(line)) {
      inSection = true;
      const rest = line.replace(/^(?:technical\s*)?skills?\s*[:,\-\s]*/i, "");
      if (rest) chunks.push(rest);
      continue;
    }
    if (inSection) {
      if (/^(?:education|experience|projects?|summary|objective|language|interests|hobbies|certifications?|achievements?|work\s*experience)\b/i.test(line)) break;
      chunks.push(line);
    }
  }
  if (!chunks.length) {
    const match = text.match(/(?:technical\s*)?skills?\s*[:,\-]?\s*([^\n]*)/i);
    if (match && match[1]) chunks.push(match[1]);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of chunks
    .join(", ")
    .split(/[\n,;•·|/]+/)
    .map((s) => s.replace(/^[•·\-\s]+|[•·\-\s]+$/g, "").trim())
    .filter(Boolean)) {
    const key = token.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(token);
    }
  }
  return out.join(", ");
}

function extractEmergencyContact(text: string): string {
  const patterns = [
    /emergency\s*(?:contact|number|phone|person)\s*:?\s*([^\n,]+)/i,
    /emergency\s*:?\s*([^\n,]+)/i,
    /(\b(?:father|mother|sibling|spouse|guardian)\b[^\n]*?\b(\+?\d[\d\s\-().]{7,})\b)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = (match[1] || match[0] || "").replace(/[ \t]+/g, " ").trim();
      if (!raw) continue;
      const phoneMatch = raw.match(/(\+?\d[\d\s\-().]{7,})/);
      const phone = phoneMatch ? normalizePhone(phoneMatch[1]) : "";
      if (!phone) continue;
      const name = raw
        .replace(phoneMatch ? phoneMatch[1] : "", "")
        .replace(/^[\s:,\-–—]+|[\s:,\-–—]+$/g, "");
      return [name, phone].filter(Boolean).join(" - ");
    }
  }
  return "";
}

// Degree keyword lists, ordered from highest qualification to lowest. The first
// (highest) rank that matches wins, so "M.Tech" beats a "B.Tech" that may also
// appear on the resume.
const FULL_DEGREE_PATTERNS: Array<[number, RegExp]> = [
  [5, /\bph\.?\s*d(?:\.)?\b|\bdoctorate\b|\bdoctoral\b/i],
  [4, /\bm\.?\s*(?:tech|e|sc|a|com)\b|\bmca\b|\bmba\b|\bpost\s*graduation\b/i],
  [3, /\bb\.?\s*(?:tech|e|sc|a|com)\b|\bbca\b|\bbba\b|\bb\.?\s*b\.?\s*a\b|\bgraduation\b/i],
  [2, /\bdiploma\b|\bpolytechnic\b/i],
  [1, /\b(?:higher\s+secondary|hsc|intermediate|12th|xii)\b/i],
  [0, /\b(?:secondary|matriculation|10th|x)\b/i],
];

// Used when no education section is detected (scanning the whole resume), so
// short forms like "BA"/"MA"/"BE" that appear inside ordinary text are avoided.
const SHORT_DEGREE_PATTERNS: Array<[number, RegExp]> = [
  [5, /\bph\.?\s*d(?:\.)?\b|\bdoctorate\b/i],
  [4, /\bm\.?\s*(?:tech|e|sc|com)\b|\bmca\b|\bmba\b/i],
  [3, /\bb\.?\s*(?:tech|e|sc|com)\b|\bbca\b|\bbba\b/i],
  [2, /\bdiploma\b|\bpolytechnic\b/i],
];

function extractHighestQualification(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const section: string[] = [];
  let inEducation = false;
  for (const line of lines) {
    if (/^(?:education|academic|qualification|educational)/i.test(line)) {
      inEducation = true;
      section.length = 0;
      continue;
    }
    if (inEducation) {
      if (/^(?:experience|work\s*experience|skills|technical\s*skills|projects?|summary|objective|interests|hobbies|certifications?|achievements?)\b/i.test(line)) break;
      section.push(line);
    }
  }

  const patterns = section.length ? FULL_DEGREE_PATTERNS : SHORT_DEGREE_PATTERNS;
  // Skip header lines like "Education:" itself.
  const corpus = (section.length ? section.join("\n") : text)
    .replace(/^(?:education|academic|qualification|educational)\b[^a-z0-9]*/i, "")
    .replace(/\s+/g, " ");

  for (const [, pattern] of patterns) {
    const match = corpus.match(pattern);
    if (match) return match[0].replace(/\s+/g, " ").toUpperCase().trim();
  }
  return "";
}

export async function parseResumeFromUrl(resumeUrl: string): Promise<ParsedResume> {
  let buffer: Buffer;
  if (resumeUrl.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", resumeUrl);
    buffer = await fs.readFile(filePath);
  } else {
    const response = await fetch(resumeUrl);
    if (!response.ok) throw new Error(`Failed to fetch resume: ${response.status}`);
    buffer = Buffer.from(await response.arrayBuffer());
  }
  return parseResume(buffer);
}

export async function parseResume(
  buffer: Buffer
): Promise<ParsedResume> {
  const data = await pdf(buffer);
  const text = data.text;
  return {
    name: extractName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    dob: extractDOB(text),
    address: extractAddress(text),
    bloodGroup: extractBloodGroup(text),
    emergencyContact: extractEmergencyContact(text),
    highestQualification: extractHighestQualification(text),
    currentCompany: extractCurrentCompany(text),
    totalExperience: extractTotalExperience(text),
    skills: extractSkills(text),
  };
}
