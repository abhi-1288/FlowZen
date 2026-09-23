export interface CandidateRegionSource {
  label?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for", "with",
  "st", "street", "road", "rd", "area", "near", "city", "state", "country",
  "pin", "zip", "code", "pincode", "w", "india",
]);

const STATE_SYNONYMS: Record<string, string> = {
  maharashtra: "maharashtra",
  mh: "maharashtra",
  "delhi ncr": "delhi",
  ncr: "delhi",
  "uttar pradesh": "uttar pradesh",
  up: "uttar pradesh",
  "west bengal": "west bengal",
  wb: "west bengal",
  "tamil nadu": "tamil nadu",
  tn: "tamil nadu",
  "karnataka": "karnataka",
  "kerala": "kerala",
  "gujarat": "gujarat",
  "rajasthan": "rajasthan",
  "telangana": "telangana",
  "andhra pradesh": "andhra pradesh",
  "punjab": "punjab",
  "haryana": "haryana",
  "odisha": "odisha",
  orissa: "odisha",
  "madhya pradesh": "madhya pradesh",
  "bihar": "bihar",
  "assam": "assam",
  "jharkhand": "jharkhand",
  "uttarakhand": "uttarakhand",
  "chhattisgarh": "chhattisgarh",
};

const STATE_NAMES: string[] = [
  "andhra pradesh",
  "arunachal pradesh",
  "assam",
  "bihar",
  "chhattisgarh",
  "goa",
  "gujarat",
  "haryana",
  "himachal pradesh",
  "jharkhand",
  "karnataka",
  "kerala",
  "madhya pradesh",
  "maharashtra",
  "manipur",
  "meghalaya",
  "mizoram",
  "nagaland",
  "odisha",
  "punjab",
  "rajasthan",
  "sikkim",
  "tamil nadu",
  "telangana",
  "tripura",
  "uttar pradesh",
  "uttarakhand",
  "west bengal",
  "delhi",
  "chandigarh",
  "puducherry",
  "jammu and kashmir",
  "ladakh",
  "andaman and nicobar",
];

const CITY_TO_STATE: Record<string, string> = {
  haldwani: "Uttarakhand",
  nainital: "Uttarakhand",
  dehradun: "Uttarakhand",
  haridwar: "Uttarakhand",
  rishikesh: "Uttarakhand",
  rudrapur: "Uttarakhand",
  kashipur: "Uttarakhand",
  roorkee: "Uttarakhand",
  pune: "Maharashtra",
  mumbai: "Maharashtra",
  "navi mumbai": "Maharashtra",
  nagpur: "Maharashtra",
  nashik: "Maharashtra",
  aurangabad: "Maharashtra",
  solapur: "Maharashtra",
  bengaluru: "Karnataka",
  bangalore: "Karnataka",
  mysore: "Karnataka",
  mangalore: "Karnataka",
  hubli: "Karnataka",
  hyderabad: "Telangana",
  chennai: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  madurai: "Tamil Nadu",
  kolkata: "West Bengal",
  delhi: "Delhi",
  "new delhi": "Delhi",
  gurugram: "Haryana",
  gurgaon: "Haryana",
  faridabad: "Haryana",
  noida: "Uttar Pradesh",
  "greater noida": "Uttar Pradesh",
  lucknow: "Uttar Pradesh",
  kanpur: "Uttar Pradesh",
  agra: "Uttar Pradesh",
  varanasi: "Uttar Pradesh",
  meerut: "Uttar Pradesh",
  jaipur: "Rajasthan",
  udaipur: "Rajasthan",
  jodhpur: "Rajasthan",
  ahmedabad: "Gujarat",
  surat: "Gujarat",
  vadodara: "Gujarat",
  gandhinagar: "Gujarat",
  kochi: "Kerala",
  cochin: "Kerala",
  thiruvananthapuram: "Kerala",
  trivandrum: "Kerala",
  kozhikode: "Kerala",
  bhubaneswar: "Odisha",
  chandigarh: "Chandigarh",
  indore: "Madhya Pradesh",
  bhopal: "Madhya Pradesh",
  jabalpur: "Madhya Pradesh",
  patna: "Bihar",
  guwahati: "Assam",
  ranchi: "Jharkhand",
  visakhapatnam: "Andhra Pradesh",
  vijayawada: "Andhra Pradesh",
  panaji: "Goa",
  shimla: "Himachal Pradesh",
  srinagar: "Jammu and Kashmir",
  jammu: "Jammu and Kashmir",
  amritsar: "Punjab",
  ludhiana: "Punjab",
};

function titleCaseState(phrase: string): string {
  return phrase
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const STATE_ALIASES: Record<string, string> = {};
for (const name of STATE_NAMES) STATE_ALIASES[name] = titleCaseState(name);
for (const [alias, name] of Object.entries(STATE_SYNONYMS)) {
  STATE_ALIASES[alias] = titleCaseState(name);
}

function paddedStateText(text: string): string {
  return ` ${String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function stateNameInText(text: string, allowAbbreviations: boolean): string {
  const normalized = paddedStateText(text);
  let bestIndex = -1;
  let best = "";
  for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
    const canonicalLower = canonical.toLowerCase();
    const isAbbreviation = alias !== canonicalLower;
    if (isAbbreviation && !allowAbbreviations) continue;
    const phrase = ` ${alias} `;
    let from = 0;
    let found = normalized.indexOf(phrase, from);
    while (found !== -1) {
      if (found > bestIndex) {
        bestIndex = found;
        best = canonical;
      }
      from = found + 1;
      found = normalized.indexOf(phrase, from);
    }
  }
  return best;
}

function stateNameByCity(text: string): string {
  const tokens = regionTokenSet(text);
  const padded = paddedStateText(text);
  for (const [city, state] of Object.entries(CITY_TO_STATE)) {
    if (city.includes(" ")) {
      if (padded.includes(` ${city} `)) return state;
    } else if (tokens.has(city)) {
      return state;
    }
  }
  return "";
}

export function stateNameOf(
  address: string | null | undefined,
  resumeText: string | null | undefined,
): string {
  const addressText = String(address ?? "");
  if (addressText.trim()) {
    const fromState = stateNameInText(addressText, true);
    if (fromState) return fromState;
    const fromCity = stateNameByCity(addressText);
    if (fromCity) return fromCity;
  }

  const resume = String(resumeText ?? "");
  if (resume.trim()) {
    const fromState = stateNameInText(resume, false);
    if (fromState) return fromState;
    const fromCity = stateNameByCity(resume);
    if (fromCity) return fromCity;
  }

  return "";
}

export function normalizeRegionToken(value: string): string {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  const asState = STATE_SYNONYMS[normalized] || normalized;
  return asState.trim();
}

export function regionTokenSet(value: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of String(value ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
    const token = normalizeRegionToken(raw);
    if (token && !STOP_WORDS.has(token)) tokens.add(token);
  }
  return tokens;
}

export function candidateTextOf(
  address: string | null | undefined,
  resumeText: string | null | undefined,
): string {
  const parts = [String(address ?? ""), String(resumeText ?? "")];
  return parts.map((p) => p.trim()).filter(Boolean).join("\n");
}

export function phraseMatchScore(textTokens: Set<string>, textLower: string, phrase: string): number {
  const phraseLower = String(phrase ?? "").toLowerCase();
  if (!phraseLower) return 0;
  const tokens = regionTokenSet(phraseLower);
  if (tokens.size === 0) return 0;
  let tokenHits = 0;
  for (const token of tokens) {
    if (textTokens.has(token)) tokenHits++;
  }
  if (tokenHits === 0) return 0;
  if (textLower.includes(phraseLower)) return tokens.size + 2;
  return tokenHits;
}

export function regionMatchScore(
  textTokens: Set<string>,
  textLower: string,
  region: CandidateRegionSource,
): number {
  const city = String(region.city ?? "").trim();
  const state = String(region.state ?? "").trim();
  const country = String(region.country ?? "").trim();

  let score = 0;
  if (city) score += phraseMatchScore(textTokens, textLower, city) * 2;
  if (state) score += phraseMatchScore(textTokens, textLower, state) * 1.5;
  if (country) score += phraseMatchScore(textTokens, textLower, country) * 1;

  if (score === 0 && city) {
    const cityTokens = regionTokenSet(city);
    for (const token of cityTokens) {
      if (textLower.includes(token)) {
        const labelCity = String(region.label ?? "");
        if (labelCity && labelCity.toLowerCase().includes(token)) score += 0.5;
        break;
      }
    }
  }
  return score;
}

export interface ClosestRegionResult {
  label: string;
  score: number;
}

export function closestRegionOf(
  input: {
    address?: string | null;
    resumeText?: string | null;
    jobLocation?: string | null;
    regions: CandidateRegionSource[];
  },
): ClosestRegionResult {
  const regions = Array.isArray(input.regions) ? input.regions : [];

  const fixed = fixedRegionLabel(input.jobLocation, input.regions);
  if (fixed) return { label: fixed, score: 4 };

  if (!jobUsesRegionDetection(input.jobLocation, input.regions)) {
    const explicit = firstRegionLabel(input.jobLocation, input.regions);
    return { label: explicit, score: explicit ? 4 : 0 };
  }

  const address = String(input.address ?? "");
  const resumeText = String(input.resumeText ?? "");
  const stateLabel = stateNameOf(address, resumeText);
  if (stateLabel) return { label: stateLabel, score: 5 };

  const text = candidateTextOf(address, resumeText);
  if (!text.trim()) return { label: "", score: 0 };

  const tokens = regionTokenSet(text);
  const lower = text.toLowerCase();

  let best: ClosestRegionResult = { label: "", score: 0 };
  for (const region of regions) {
    const label = String(region.label ?? "").trim();
    if (!label) continue;
    const score = regionMatchScore(tokens, lower, region);
    if (score > best.score) best = { label, score };
  }

  if (best.score >= 1) return best;
  return { label: "", score: 0 };
}

export function jobUsesRegionDetection(
  jobLocation: string | null | undefined,
  regions: CandidateRegionSource[],
): boolean {
  return !fixedRegionLabel(jobLocation, regions);
}

export function fixedRegionLabel(
  jobLocation: string | null | undefined,
  regions: CandidateRegionSource[],
): string {
  const location = String(jobLocation ?? "").trim();
  if (!location) return "";
  if (/^remote$/i.test(location) || /^pan$/i.test(location)) return "";
  const match = (Array.isArray(regions) ? regions : []).find(
    (r) => String(r.label ?? "").trim().toLowerCase() === location.toLowerCase(),
  );
  return match ? String(match.label ?? "").trim() : "";
}

export function firstRegionLabel(
  jobLocation: string | null | undefined,
  regions: CandidateRegionSource[],
): string {
  const location = String(jobLocation ?? "").trim();
  if (!location) return "";
  const exact = fixedRegionLabel(location, regions);
  if (exact) return exact;
  if (/^remote$/i.test(location) || /^pan$/i.test(location)) return "";
  return location;
}