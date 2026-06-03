/**
 * Customer name matching utilities.
 *
 * Purpose: stop users from silently creating duplicate customers — including the
 * case where the same client is stored in Hebrew but searched for in English
 * (or vice-versa). We do this with two derived forms of a name:
 *
 *  1. `normalizeCustomerName` — a script-preserving canonical form (lower-cased,
 *     trimmed, Hebrew niqqud removed, final-letter forms folded, punctuation and
 *     whitespace stripped). Good for catching "Acme Ltd." vs "acme  ltd".
 *
 *  2. `customerNameSkeleton` — a cross-script consonant skeleton. Hebrew letters
 *     are transliterated to Latin, vowels/weak sounds are dropped, and similar
 *     consonants are folded into a single class. This is what lets "Cohen" match
 *     "כהן" and "Levi" match "לוי".
 *
 * `customerNameSimilarity` combines both into a 0..1 score, and
 * `findSimilarCustomers` returns the likely-duplicate candidates for a name.
 *
 * Matching is intentionally loose (recall over precision): the UI only *warns*
 * and always lets the user add anyway, so a false positive costs one click while
 * a false negative costs a duplicate record.
 */

/** Default similarity threshold above which two names are treated as "likely the same". */
export const CUSTOMER_NAME_SIMILARITY_THRESHOLD = 0.72;

// Hebrew combining marks (niqqud + cantillation): U+0591–U+05C7.
const HEBREW_DIACRITICS = /[֑-ׇ]/g;
// Latin combining marks produced by NFD normalization (accents/diacritics).
const LATIN_COMBINING_MARKS = /[̀-ͯ]/g;

// Hebrew final-letter forms → their standard form, so "כהן" and a mid-word "כ" align.
const HEBREW_FINAL_FORMS: Record<string, string> = {
  'ך': 'כ', // ך → כ
  'ם': 'מ', // ם → מ
  'ן': 'נ', // ן → נ
  'ף': 'פ', // ף → פ
  'ץ': 'צ'  // ץ → צ
};

// Hebrew consonant → Latin transliteration. Matres lectionis (א/ה/ו/י) and the
// silent ע map to weak letters that the skeleton step later drops.
const HEBREW_TO_LATIN: Record<string, string> = {
  'א': 'a', // א
  'ב': 'b', // ב
  'ג': 'g', // ג
  'ד': 'd', // ד
  'ה': 'h', // ה
  'ו': 'v', // ו
  'ז': 'z', // ז
  'ח': 'h', // ח
  'ט': 't', // ט
  'י': 'y', // י
  'כ': 'k', // כ
  'ל': 'l', // ל
  'מ': 'm', // מ
  'נ': 'n', // נ
  'ס': 's', // ס
  'ע': 'a', // ע
  'פ': 'p', // פ
  'צ': 's', // צ (tsadi → sibilant class)
  'ק': 'k', // ק
  'ר': 'r', // ר
  'ש': 's', // ש (shin → sibilant class)
  'ת': 't'  // ת
};

/** Strips a small set of legal/company suffixes that add noise to name matching. */
const COMPANY_SUFFIXES = /\b(ltd|limited|inc|llc|llp|co|corp|company|gmbh)\b/g;

/**
 * Script-preserving canonical form: lower-cased, accent/niqqud-stripped,
 * Hebrew final forms folded, company suffixes and all non-alphanumerics removed.
 */
export function normalizeCustomerName(raw: string | null | undefined): string {
  if (!raw) {
    return '';
  }
  let value = raw.normalize('NFD').replace(LATIN_COMBINING_MARKS, '');
  value = value.replace(HEBREW_DIACRITICS, '');
  value = value.toLowerCase();
  value = value.replace(/[ךםןףץ]/g, (ch) => HEBREW_FINAL_FORMS[ch] ?? ch);
  value = value.replace(COMPANY_SUFFIXES, ' ');
  // Keep Hebrew letters, Latin letters and digits; drop everything else.
  value = value.replace(/[^0-9a-zא-ת]+/g, '');
  return value;
}

/** Folds Latin consonants into broad phonetic classes so cross-language forms align. */
function foldConsonants(value: string): string {
  return value
    .replace(/sh|tz|ts|ch/g, 's')   // sibilant / affricate cluster → s (ch handled before single c)
    .replace(/ck|kh|q|c/g, 'k')     // hard-k family → k
    .replace(/ph|f/g, 'p')          // f/ph → p (mirrors פ)
    .replace(/v|w/g, 'b')           // v/w → b (mirrors ב/ו)
    .replace(/z/g, 's')             // z → s
    .replace(/j/g, 'g');            // j → g
}

/**
 * Cross-script consonant skeleton used for Hebrew↔English matching.
 * Transliterates Hebrew → Latin, folds consonant classes, drops vowels and weak
 * letters, then collapses repeats. e.g. "Cohen" and "כהן" both reduce to "kn".
 */
export function customerNameSkeleton(raw: string | null | undefined): string {
  const normalized = normalizeCustomerName(raw);
  if (!normalized) {
    return '';
  }
  // Transliterate any Hebrew letters to Latin; keep Latin/digits as-is.
  let latin = '';
  for (const ch of normalized) {
    latin += HEBREW_TO_LATIN[ch] ?? ch;
  }
  latin = foldConsonants(latin);
  // Drop vowels and weak letters (h/y/w/a/e/i/o/u) — Hebrew rarely writes vowels.
  latin = latin.replace(/[aeiouhyw]/g, '');
  // Collapse runs of the same consonant (e.g. "ll" → "l").
  latin = latin.replace(/(.)\1+/g, '$1');
  return latin;
}

/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Levenshtein-based similarity ratio in 0..1 (1 = identical). */
function ratio(a: string, b: string): number {
  if (!a.length && !b.length) {
    return 1;
  }
  const max = Math.max(a.length, b.length);
  if (max === 0) {
    return 1;
  }
  return 1 - levenshtein(a, b) / max;
}

/**
 * Similarity score in 0..1 for two customer names, combining same-script and
 * cross-script (Hebrew↔English) comparison. Higher = more likely the same client.
 */
export function customerNameSimilarity(a: string, b: string): number {
  const normA = normalizeCustomerName(a);
  const normB = normalizeCustomerName(b);
  if (!normA || !normB) {
    return 0;
  }
  if (normA === normB) {
    return 1;
  }
  // Substring containment (e.g. "acme" vs "acmeindustries") is a strong signal.
  if (normA.length >= 3 && normB.length >= 3 && (normA.includes(normB) || normB.includes(normA))) {
    return 0.9;
  }
  const sameScript = ratio(normA, normB);
  const skelA = customerNameSkeleton(a);
  const skelB = customerNameSkeleton(b);
  let crossScript = 0;
  if (skelA && skelB) {
    crossScript = skelA === skelB ? 0.95 : ratio(skelA, skelB);
  }
  return Math.max(sameScript, crossScript);
}

export interface NamedCustomer {
  id: string;
  name: string;
}

export interface SimilarCustomerMatch<T extends NamedCustomer> {
  customer: T;
  score: number;
}

export interface FindSimilarOptions {
  /** Minimum similarity score to include. Defaults to {@link CUSTOMER_NAME_SIMILARITY_THRESHOLD}. */
  threshold?: number;
  /** Customer id to exclude (e.g. the record being edited). */
  excludeId?: string;
  /** Max number of matches to return (best-scoring first). Defaults to 5. */
  limit?: number;
}

/**
 * Returns customers whose name is similar to (or the same as) `name`, sorted by
 * descending similarity. Used to warn before a duplicate is created.
 */
export function findSimilarCustomers<T extends NamedCustomer>(
  name: string,
  customers: readonly T[],
  options: FindSimilarOptions = {}
): SimilarCustomerMatch<T>[] {
  const threshold = options.threshold ?? CUSTOMER_NAME_SIMILARITY_THRESHOLD;
  const limit = options.limit ?? 5;
  if (!normalizeCustomerName(name)) {
    return [];
  }
  const matches: SimilarCustomerMatch<T>[] = [];
  for (const customer of customers) {
    if (options.excludeId && customer.id === options.excludeId) {
      continue;
    }
    const score = customerNameSimilarity(name, customer.name);
    if (score >= threshold) {
      matches.push({ customer, score });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * True if `term` matches `name` for search purposes — substring on the
 * canonical form OR a close cross-language skeleton match. Lets a Hebrew-stored
 * client surface when searched in English and vice-versa.
 */
export function customerNameMatchesSearch(name: string, term: string): boolean {
  const normTerm = normalizeCustomerName(term);
  if (!normTerm) {
    return true;
  }
  const normName = normalizeCustomerName(name);
  if (normName.includes(normTerm)) {
    return true;
  }
  const skelTerm = customerNameSkeleton(term);
  if (skelTerm.length >= 2) {
    const skelName = customerNameSkeleton(name);
    if (skelName.includes(skelTerm) || skelTerm.includes(skelName)) {
      return true;
    }
  }
  return false;
}
