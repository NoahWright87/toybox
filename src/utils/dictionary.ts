/**
 * Shared word game dictionary utility.
 *
 * Source: ENABLE word list (public domain, designed for word games),
 * filtered to 3–8 letter alphabetic words with slurs and hard profanity
 * removed.
 *
 * All lookups are O(1) after the first call, which parses and caches the
 * word set lazily.
 */

import rawWords from "../data/words/wordlist-clean.txt?raw";
import rawMetadata from "../data/words/word-metadata.json";

// ---------------------------------------------------------------------------
// Internal cache
// ---------------------------------------------------------------------------

let _wordSet: Set<string> | null = null;
const _metadata: Record<string, { difficulty: number; length: number }> = rawMetadata;

function getWordSet(): Set<string> {
  if (!_wordSet) {
    _wordSet = new Set<string>();
    for (const word of rawWords.split("\n")) {
      const w = word.trim();
      if (w) _wordSet.add(w);
    }
  }
  return _wordSet;
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
 */
export function isValidWord(word: string): boolean {
  return getWordSet().has(word.toLowerCase());
}

/**
 * Returns all dictionary words of exactly `length` letters.
 *
 * @param length - Desired word length (3–8).
 */
export function getWordsOfLength(length: number): string[] {
  const result: string[] = [];
  for (const word of getWordSet()) {
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
 *
 * @example
 * // With tiles for "PLATES", find all valid sub-words:
 * getAnagramsOf("plates");
 * // → ["ale", "ales", "ape", "apes", "apt", ..., "staple", "plates", ...]
 */
export function getAnagramsOf(letters: string, minLength = 3): string[] {
  const available = letterCounts(letters.toLowerCase());
  const maxLen = letters.length;
  const result: string[] = [];

  for (const word of getWordSet()) {
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
 *
 * @example
 * getExactAnagramsOf("listen"); // → ["enlist", "inlets", "listen", "silent", "tinsel"]
 */
export function getExactAnagramsOf(letters: string): string[] {
  const lower = letters.toLowerCase();
  const sorted = lower.split("").sort().join("");

  const result: string[] = [];
  for (const word of getWordSet()) {
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
 * @param maxDifficulty - Maximum difficulty score (0-100). Optional.
 * @returns A random word, or `null` if no word of that length exists.
 */
export function getRandomWord(length: number, maxDifficulty?: number): string | null {
  let pool = getWordsOfLength(length);
  if (maxDifficulty !== undefined) {
    pool = pool.filter((w) => (_metadata[w]?.difficulty ?? 50) <= maxDifficulty);
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get the difficulty score of a word.
 *
 * @param word - The word to check.
 * @returns Difficulty score (0-100), or 50 if not found.
 */
export function getWordDifficulty(word: string): number {
  return _metadata[word.toLowerCase()]?.difficulty ?? 50;
}
