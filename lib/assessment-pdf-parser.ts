import pdf from "pdf-parse/lib/pdf-parse.js";

export type ParsedAssessmentQuestion = {
  text: string;
  options: string[];
  correctIndex: number;
  type: "mcq" | "essay";
  answer: string;
  section?: string;
};

export type ParsedSection = {
  name: string;
  questionCount: number;
};

export type ParseAssessmentPdfResult = {
  questions: ParsedAssessmentQuestion[];
  sections: ParsedSection[];
  warnings: string[];
  text: string;
};

const QUESTION_START =
  /^\s*(?:(?:Q|Question)\.?\s*)?(\d{1,3})\s*[.)\]:-]\s*(?=\S)/i;
const OPTION_START = /^\s*\(?([A-Da-d])\)?\s*[.)\]:-]\s+(.+)$/;

// Splits a line holding multiple options in sequence, e.g. "A) 24 B) 32 C) 36 D) 40".
const INLINE_OPTION = /\(?([A-Da-d])\)?\s*[.)\]:-]\s+/g;
function splitInlineOptions(line: string): string[] | null {
  const matches = Array.from(line.matchAll(INLINE_OPTION));
  if (matches.length < 2) return null;
  const letters = matches.map((m) => m[1].toUpperCase());
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] !== String.fromCharCode(65 + i)) return null;
  }
  const opts: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const prev = matches[i - 1];
    const start = prev ? prev.index + prev[0].length : 0;
    const seg = line.slice(start, matches[i].index).trim();
    if (seg) opts.push(seg);
  }
  const lastMatch = matches[matches.length - 1];
  const last = line.slice(lastMatch.index + lastMatch[0].length).trim();
  if (last) opts.push(last);
  return opts.length >= 2 ? opts : null;
}
const ANSWER_LABEL = /^\s*(?:answers?\s+key|correct\s+answer|answers|answer|ans|key)\s*[:=.*-]*\s*(.*)$/i;
const KEY_NUMBERED = /^\s*(\d{1,3})\s*[.):-]?\s*\(?([A-D])\)?\s*$/i;
const KEY_LETTER = /^\(?([A-D])\)?\.?\s*$/i;
const KEY_NUMBERED_INLINE = /(\d{1,3})\s*[.):\-]?\s*\(?([A-Da-d])\)?/g;
const QUESTION_LIKE = /\?\s*$/;

// Section / domain header detection.
// Matches lines like "Section A: General Knowledge", "Part 1 - Mechanical", "Domain: React", "Category B".
// The optional (letter|number + separator) group strips a prefix index so the captured
// group is clean, e.g. "Section A: GK" -> "GK", "Part 1 - Mech" -> "Mech", "Section: JS" -> "JS".
const SECTION_HEADER = /^\s*(?:section|part|domain|category|module)[\s.\-:\u2013\u2014]*\s*(?:(?:[A-Za-z]{1,3}|\d{1,3})[\s.\-:\u2013\u2014]+\s*)?(.+)$/i;

const LETTER_TO_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 };

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\r\n?|\f/g, "\n");
}

type QuestionBuffer = {
  text: string[];
  options: string[];
  startedOptions: boolean;
};

export function parseAssessmentText(rawText: string): {
  questions: ParsedAssessmentQuestion[];
  sections: ParsedSection[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines = normalizeText(rawText)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const questions: ParsedAssessmentQuestion[] = [];
  const pdfNumbers: (number | null)[] = [];
  const resolvedByInline = new Set<number>();
  let current: QuestionBuffer | null = null;
  let pending: string[] = [];
  let currentSection = "";
  let sectionStartIndex = 0;

  // Answer key resolution: keys are scoped to the section they appear in,
  // because multi-section PDFs commonly restart question numbering per section.
  // Numbered keys reference the original PDF question number within the section
  // (answerByPdf); bare ordered lists map positionally (answerBySeq).
  const answerByPdf = new Map<string, Map<number, number>>();
  const answerBySeq = new Map<string, Map<number, number>>();
  let keySection = "";
  let inKeyBlock = false;
  let keyBlockSequence = 0;
  let currentAnswer = -1;

  const flushPendingAsQuestion = () => {
    if (!pending.length) return;
    const text = pending.join(" ").replace(/\s+/g, " ").trim();
    if (text && QUESTION_LIKE.test(text)) {
      questions.push({ text, options: [], correctIndex: 0, type: "essay", answer: "", section: currentSection || undefined });
      pdfNumbers.push(null);
    }
    pending = [];
  };

  const close = () => {
    if (!current) return;
    const text = current.text.join(" ").replace(/\s+/g, " ").trim();
    const options = current.options.map((o) => o.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (text) {
      const qIndex = questions.length;
      const isEssay = options.length < 2;
      let correctIndex = 0;
      if (!isEssay) {
        if (currentAnswer >= 0 && currentAnswer < options.length) {
          correctIndex = currentAnswer;
          resolvedByInline.add(qIndex);
        }
      }
      questions.push({ text, options: isEssay ? [] : options, correctIndex, type: isEssay ? "essay" : "mcq", answer: "", section: currentSection || undefined });
      pdfNumbers.push(null);
    }
    current = null;
  };

  for (const line of lines) {
    const ansLine = line.match(ANSWER_LABEL);
    if (ansLine) {
      const rest = ansLine[1]
        .replace(/^\s*key\s*[:=.*-]*\s*/i, "")
        .replace(/^[\s:.*\-,]+/, "")
        .trim();
      if (!rest) {
        // Bare "Answers:" header -> subsequent lines form the key block.
        inKeyBlock = true;
        keySection = currentSection;
        keyBlockSequence = 0;
        if (!answerBySeq.has(keySection)) answerBySeq.set(keySection, new Map());
        close();
        continue;
      }
      inKeyBlock = false;
      let inlineMatched = false;
      const inline = Array.from(rest.matchAll(KEY_NUMBERED_INLINE));
      if (inline.length) {
        const secMap = answerByPdf.get(currentSection) ?? new Map<number, number>();
        for (const m of inline) {
          secMap.set(Number(m[1]), LETTER_TO_INDEX[m[2].toUpperCase()]);
        }
        answerByPdf.set(currentSection, secMap);
        inlineMatched = true;
      }
      if (!inlineMatched) {
        // Inline single letter, e.g. "Answer: A" or "Answer: B) 32" (letter is the key).
        const singleLetter = rest.match(/^\s*\(?([A-Da-d])\)?\s*[.):\]-]?\s*(?:option\s+)?/);
        if (singleLetter && current && current.options.length >= 2) {
          currentAnswer = LETTER_TO_INDEX[singleLetter[1]];
        }
      }
      continue;
    }

    if (inKeyBlock) {
      const numbered = line.match(KEY_NUMBERED);
      if (numbered) {
        const secMap = answerByPdf.get(keySection) ?? new Map<number, number>();
        secMap.set(Number(numbered[1]), LETTER_TO_INDEX[numbered[2].toUpperCase()]);
        answerByPdf.set(keySection, secMap);
        keyBlockSequence = Math.max(keyBlockSequence, Number(numbered[1]));
        continue;
      }
      const letter = line.match(KEY_LETTER);
      if (letter) {
        const secMap = answerBySeq.get(keySection) ?? new Map<number, number>();
        secMap.set(sectionStartIndex + keyBlockSequence, LETTER_TO_INDEX[letter[1].toUpperCase()]);
        answerBySeq.set(keySection, secMap);
        keyBlockSequence++;
        continue;
      }
      const numberedInline = Array.from(line.matchAll(KEY_NUMBERED_INLINE));
      if (numberedInline.length) {
        const secMap = answerByPdf.get(keySection) ?? new Map<number, number>();
        for (const m of numberedInline) {
          secMap.set(Number(m[1]), LETTER_TO_INDEX[m[2].toUpperCase()]);
          keyBlockSequence = Math.max(keyBlockSequence, Number(m[1]));
        }
        answerByPdf.set(keySection, secMap);
        continue;
      }
      inKeyBlock = false;
    }

    const sec = line.match(SECTION_HEADER);
    if (sec && line.length <= 70 && !/[.?!]\s*$/.test(line)) {
      const name = sec[1].replace(/\s+/g, " ").trim();
      if (name) {
        flushPendingAsQuestion();
        close();
        currentSection = name;
        sectionStartIndex = questions.length;
        currentAnswer = -1;
      }
      continue;
    }

    const qStart = line.match(QUESTION_START);
    if (qStart) {
      flushPendingAsQuestion();
      close();
      const qIdx = questions.length;
      pdfNumbers[qIdx] = Number(qStart[1]);
      current = { text: [], options: [], startedOptions: false };
      currentAnswer = -1;
      const rest = line.replace(/^\s*(?:(?:Q|Question)\.?\s*)?\d{1,3}\s*[.)\]:-]\s*/, "").trim();
      if (rest) current.text.push(rest);
      continue;
    }

    const opt = line.match(OPTION_START);
    if (opt) {
      const extra = splitInlineOptions(line) ?? [opt[2]];
      if (!current) {
        // Option without a numbered header: promote pending lines to the question.
        current = { text: pending, options: [], startedOptions: true };
        pending = [];
        current.options.push(...extra);
        continue;
      }
      if (!current.startedOptions) {
        current.startedOptions = true;
      }
      current.options.push(...extra);
      continue;
    }

    if (current) {
      if (current.startedOptions && current.options.length > 0) {
        current.options[current.options.length - 1] += " " + line;
      } else {
        current.text.push(line);
      }
    } else {
      pending.push(line);
    }
  }

  close();
  flushPendingAsQuestion();

  // Apply explicit answer keys. Keys are scoped per section; numbered entries
  // reference the original PDF question number within that section. A question
  // flagged mcq without any key gets a warning.
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.type !== "mcq") continue;
    const secKey = q.section || "";
    const pdfKey = q && pdfNumbers[i] != null ? answerByPdf.get(secKey)?.get(pdfNumbers[i]!) : undefined;
    const seqKey = answerBySeq.get(secKey)?.get(i);
    const mapped = pdfKey !== undefined ? pdfKey : seqKey !== undefined ? seqKey : undefined;
    if (mapped !== undefined) {
      if (mapped < q.options.length) {
        q.correctIndex = mapped;
      } else {
        warnings.push(`Question ${i + 1}: answer key points to a missing option — please check.`);
      }
    } else if (!resolvedByInline.has(i)) {
      warnings.push(`Question ${i + 1}: correct answer not detected — please set it in the review step.`);
    }
  }

  // Build detected section summary from question tags.
  const sections: ParsedSection[] = [];
  for (const q of questions) {
    const name = q.section?.trim();
    if (!name) continue;
    const existing = sections.find((s) => s.name === name);
    if (existing) existing.questionCount++;
    else sections.push({ name, questionCount: 1 });
  }

  return { questions, sections, warnings };
}

export async function parseAssessmentPdf(buffer: Buffer): Promise<ParseAssessmentPdfResult> {
  const data = await pdf(buffer);
  const { questions, sections, warnings } = parseAssessmentText(data.text);
  return { questions, sections, warnings, text: data.text };
}