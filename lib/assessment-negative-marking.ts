// Negative marking is a FLAT penalty: the same number of marks is deducted for
// every wrong answer, whatever that question is worth. HR may enter it as a
// fraction ("1/4", "1/3") or as a decimal ("0.25"), so this module owns parsing
// and rendering in one place.
//
// `negativeMarking` on ATSAssessment stays a Number and stays authoritative for
// scoring. `negativeMarkingLabel` is only a display aid holding the reduced
// fraction HR typed, and is always re-validated against the number server-side.

/** Mirrors `negativeMarking: { min: 0, max: 100 }` on the schema. */
export const MAX_NEGATIVE_MARKING = 100;

/** Largest denominator tried when guessing a fraction for a plain decimal. */
const MAX_DENOMINATOR = 64;

const FRACTION_RE = /^\d{1,4}(?:\.\d{1,4})?\s*\/\s*\d{1,4}(?:\.\d{1,4})?$/;
/** Accepts "0", "4", "0.25" and the shorthand ".25". */
const DECIMAL_RE = /^(?:\d{1,4}(?:\.\d{1,6})?|\.\d{1,6})$/;

export type ParsedNegativeMarking =
  | { ok: true; value: number; label: string }
  | { ok: false; error: string };

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Reduce n/d to lowest terms, e.g. 2/8 -> 1/4. */
export function reduceFraction(n: number, d: number): [number, number] {
  const scale = 10 ** 4;
  const rn = Math.round(n * scale);
  const rd = Math.round(d * scale);
  const g = gcd(rn, rd);
  return [rn / g, rd / g];
}

/**
 * Find the shortest fraction that equals `value` exactly, scanning denominators
 * low to high. 0.25 -> 1/4, 0.5 -> 1/2, 1/3 -> 1/3, but 0.37 finds nothing and
 * returns "" so an arbitrary decimal is never shown as an ugly "37/100".
 */
export function decimalToFractionLabel(value: number): string {
  if (!(value > 0) || value > MAX_NEGATIVE_MARKING) return "";
  for (let d = 1; d <= MAX_DENOMINATOR; d++) {
    const n = value * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) {
      const [rn, rd] = reduceFraction(Math.round(n), d);
      // A whole number needs no fraction, and a denominator past our search
      // range is not a fraction worth showing.
      if (rd <= 1 || rd > MAX_DENOMINATOR) return "";
      return `${rn}/${rd}`;
    }
  }
  return "";
}

/**
 * Accepts "1/4", " 3/4 ", "2/7", "0.25", ".25", "1/3", "0" and "".
 * Returns the scoring value plus the fraction label to store, or a message HR
 * can act on.
 */
export function parseNegativeMarking(raw: string): ParsedNegativeMarking {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: true, value: 0, label: "" };

  if (text.includes("/")) {
    if (!FRACTION_RE.test(text)) {
      return { ok: false, error: "Use a fraction like 1/4 or 1/3, with numbers either side of the slash." };
    }
    const [nText, dText] = text.split("/");
    const numerator = Number(nText.trim());
    const denominator = Number(dText.trim());
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return { ok: false, error: "The denominator cannot be 0." };
    }
    const value = numerator / denominator;
    if (value > MAX_NEGATIVE_MARKING) {
      return { ok: false, error: `Negative marking cannot be more than ${MAX_NEGATIVE_MARKING} marks.` };
    }
    const [rn, rd] = reduceFraction(numerator, denominator);
    // "4/1" and "8/4" are just whole numbers; no fraction label needed.
    return { ok: true, value, label: rd <= 1 ? "" : `${rn}/${rd}` };
  }

  if (!DECIMAL_RE.test(text)) {
    return { ok: false, error: "Enter a number or a fraction, for example 0.25 or 1/4." };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Enter a number or a fraction, for example 0.25 or 1/4." };
  }
  if (value > MAX_NEGATIVE_MARKING) {
    return { ok: false, error: `Negative marking cannot be more than ${MAX_NEGATIVE_MARKING} marks.` };
  }
  return { ok: true, value, label: decimalToFractionLabel(value) };
}

/** Trim trailing zeros: 39.750 -> "39.75", 40.0 -> "40". */
function trimNumber(value: number, maxDecimals: number): string {
  return String(Number(value.toFixed(maxDecimals)));
}

/** "1/4 (0.25)", "1/3 (0.3333)", "0.37". Empty when marking is off. */
export function formatNegativeMarking(value: number, label?: string | null): string {
  const numeric = Number(value) || 0;
  if (numeric <= 0) return "";
  const fraction = String(label ?? "").trim();
  const decimal = trimNumber(numeric, 4);
  return fraction ? `${fraction} (${decimal})` : decimal;
}

/** "1/4" or "0.37" — single token for tight spaces like the exam header. */
export function negativeMarkingShort(value: number, label?: string | null): string {
  const numeric = Number(value) || 0;
  if (numeric <= 0) return "";
  const fraction = String(label ?? "").trim();
  return fraction || trimNumber(numeric, 4);
}

/**
 * Marks can go fractional with negative marking, so trim them for display.
 * Typed loosely because these values arrive straight off JSON APIs.
 */
export function formatMarks(value: number | string | null | undefined): string {
  if (value == null || value === "") return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return trimNumber(numeric, 2);
}
