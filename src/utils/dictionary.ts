/**
 * Shared word game dictionary utility.
 *
 * Source: ENABLE word list (public domain, designed for word games),
 * filtered to 3–8 letter alphabetic words. Offensive words are separated
 * into a secondary list and excluded by default.
 *
 * All lookups are O(1) after the first call, which parses and caches the
 * word sets lazily.
 */

import rawClean from "../data/words/wordlist-clean.txt?raw";
import rawOffensive from "../data/words/wordlist-offensive.txt?raw";

export interface DictionaryOptions {
  /** Include offensive/profane words in results. Defaults to false. */
  includeOffensive?: boolean;
}

// ---------------------------------------------------------------------------
// Internal cache
// ---------------------------------------------------------------------------

let _cleanSet: Set<string> | null = null;
let _offensiveSet: Set<string> | null = null;
let _combinedSet: Set<string> | null = null;

function parseList(raw: string): Set<string> {
  const set = new Set<string>();
  for (const word of raw.split("\n")) {
    const w = word.trim();
    if (w) set.add(w);
  }
  return set;
}

function getCleanSet(): Set<string> {
  if (!_cleanSet) _cleanSet = parseList(rawClean);
  return _cleanSet;
}

function getOffensiveSet(): Set<string> {
  if (!_offensiveSet) _offensiveSet = parseList(rawOffensive);
  return _offensiveSet;
}

function getCombinedSet(): Set<string> {
  if (!_combinedSet) {
    _combinedSet = new Set(getCleanSet());
    for (const w of getOffensiveSet()) _combinedSet.add(w);
  }
  return _combinedSet;
}

function getWordSet(options?: DictionaryOptions): Set<string> {
  return options?.includeOffensive ? getCombinedSet() : getCleanSet();
}

// ---------------------------------------------------------------------------
// Letter frequency helpers (used by anagram functions)
// ---------------------------------------------------------------------------

type LetterCounts = Record<string, number>;

function letterCounts(word: string): LetterCounts {
  const counts: LetterCounts = {};
  for (const ch of word) {
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  return counts;
}

/** Returns true if every letter in `need` is available in `have`. */
function canFormFrom(need: LetterCounts, have: LetterCounts): boolean {
  for (const [ch, count] of Object.entries(need)) {
    if ((have[ch] ?? 0) < count) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if `word` appears in the dictionary.
 *
 * @param word - The word to look up (case-insensitive).
 * @param options - Set `includeOffensive: true` to allow offensive words.
 */
export function isValidWord(word: string, options?: DictionaryOptions): boolean {
  return getWordSet(options).has(word.toLowerCase());
}

/**
 * Returns all dictionary words of exactly `length` letters.
 *
 * @param length - Desired word length (3–8).
 * @param options - Set `includeOffensive: true` to include offensive words.
 */
export function getWordsOfLength(
  length: number,
  options?: DictionaryOptions
): string[] {
  const result: string[] = [];
  for (const word of getWordSet(options)) {
    if (word.length === length) result.push(word);
  }
  return result;
}

/**
 * Returns all dictionary words that can be formed using a **subset** of the
 * provided letters. Each letter in `letters` may be used at most as many
 * times as it appears.
 *
 * This is the core mechanic for Text Twist and similar anagram games: given
 * a set of tiles, find every valid word you can spell.
 *
 * @param letters - The available letters (order doesn't matter, case-insensitive).
 * @param minLength - Minimum word length to include. Defaults to 3.
 * @param options - Set `includeOffensive: true` to include offensive words.
 *
 * @example
 * // With tiles for "PLATES", find all valid sub-words:
 * getAnagramsOf("plates", { includeOffensive: false });
 * // → ["ale", "ales", "ape", "apes", "apt", ..., "staple", "plates", ...]
 */
export function getAnagramsOf(
  letters: string,
  minLength = 3,
  options?: DictionaryOptions
): string[] {
  const available = letterCounts(letters.toLowerCase());
  const maxLen = letters.length;
  const result: string[] = [];

  for (const word of getWordSet(options)) {
    if (word.length < minLength || word.length > maxLen) continue;
    if (canFormFrom(letterCounts(word), available)) result.push(word);
  }

  return result;
}

/**
 * Returns all dictionary words that are **exact** anagrams of `letters`
 * (i.e., use every letter exactly once).
 *
 * @param letters - The letters to rearrange (case-insensitive).
 * @param options - Set `includeOffensive: true` to include offensive words.
 *
 * @example
 * getExactAnagramsOf("listen"); // → ["enlist", "inlets", "listen", "silent", "tinsel"]
 */
export function getExactAnagramsOf(
  letters: string,
  options?: DictionaryOptions
): string[] {
  const lower = letters.toLowerCase();
  const sorted = lower.split("").sort().join("");

  const result: string[] = [];
  for (const word of getWordSet(options)) {
    if (word.length !== lower.length) continue;
    if (word.split("").sort().join("") === sorted) result.push(word);
  }
  return result;
}

/**
 * Returns a random word of the specified length from the dictionary.
 * Useful for generating puzzle seeds.
 *
 * @param length - Desired word length.
 * @param options - Set `includeOffensive: true` to include offensive words.
 * @returns A random word, or `null` if no word of that length exists.
 */
export function getRandomWord(
  length: number,
  options?: DictionaryOptions
): string | null {
  const pool = getWordsOfLength(length, options);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
