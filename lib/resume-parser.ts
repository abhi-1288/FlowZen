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
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
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
  const addressKeywords = /address|current\s*address|permanent\s*address|residence/i;
  let capture = false;
  const parts: string[] = [];
  for (const line of lines) {
    if (addressKeywords.test(line)) {
      capture = true;
      const after = line.replace(addressKeywords, "").replace(/^[:,\s]+/, "");
      if (after) parts.push(after);
      continue;
    }
    if (capture) {
      if (/^(phone|email|mobile|date\s*of\s*birth|objective|summary|education|experience|skills)/i.test(line)) break;
      parts.push(line);
    }
  }
  return parts.join(", ").replace(/^[,.\s]+|[,.\s]+$/g, "");
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
      const name = raw.replace(phoneMatch ? phoneMatch[1] : "", "").replace(/^[:,\s]+|[:,\s]+$/g, "");
      return [name, phone].filter(Boolean).join(" - ");
    }
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
  };
}
