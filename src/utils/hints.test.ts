/**
 * Unit tests for Word Whirlwind hint system.
 *
 * The hint system shows letters based on what the player can deduce from:
 * 1. The common prefix between bracketing found words (for words in between)
 * 2. The available letters and the earliest found word (for words before it)
 * 3. The available letters and the latest found word (for words after it)
 *
 * Run: node --test src/utils/hints.test.ts
 */

import assert from "assert";

/**
 * Compute how many letters should be revealed as a hint for each word.
 *
 * @param allWords - All words in sorted order
 * @param foundWords - Set of guessed/found words
 * @param availableLetters - The letters available in the puzzle
 * @returns Map from word -> number of letters to reveal as hint
 */
function computeHintReveals(
  allWords: string[],
  foundWords: Set<string>,
  availableLetters: Set<string>
): Map<string, number> {
  const hints = new Map<string, number>();

  // Find earliest and latest found words
  let earliestFound: string | null = null;
  let latestFound: string | null = null;
  for (const word of allWords) {
    if (foundWords.has(word)) {
      if (earliestFound === null) earliestFound = word;
      latestFound = word;
    }
  }

  // For each word, compute hint reveal count
  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i];
    if (foundWords.has(word)) continue; // Don't hint found words

    let reveal = 0;

    // Find nearest found words on each side
    let left: string | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (foundWords.has(allWords[j])) {
        left = allWords[j];
        break;
      }
    }

    let right: string | null = null;
    for (let j = i + 1; j < allWords.length; j++) {
      if (foundWords.has(allWords[j])) {
        right = allWords[j];
        break;
      }
    }

    // Case 1: Word is between two found words
    if (left !== null && right !== null) {
      // Show common prefix of the two bracketing words
      let i = 0;
      while (
        i < left.length &&
        i < right.length &&
        left[i].toLowerCase() === right[i].toLowerCase()
      ) {
        i++;
      }
      reveal = i;
    }
    // Case 2: Word comes before all found words (before earliest)
    else if (left === null && earliestFound !== null) {
      // Determine how many letters of earliestFound can be deduced from available letters
      const availableArray = Array.from(availableLetters)
        .map((x) => x.toLowerCase())
        .sort();
      const remaining = new Set(availableArray);

      for (let j = 0; j < earliestFound.length; j++) {
        const letter = earliestFound[j].toLowerCase();
        // Check if this letter is the earliest remaining available letter
        const earliestRemaining = Array.from(remaining).sort()[0];
        if (letter === earliestRemaining) {
          reveal++;
          remaining.delete(letter);
        } else {
          break; // Stop if letter doesn't match
        }
      }
    }
    // Case 3: Word comes after all found words (after latest)
    else if (right === null && latestFound !== null) {
      // Check from start of latestFound word, matching against latest available letters
      const availableArray = Array.from(availableLetters)
        .map((x) => x.toLowerCase())
        .sort((a, b) => b.localeCompare(a)); // Reverse sort (latest first)
      const remaining = new Set(availableArray);

      for (let j = 0; j < latestFound.length; j++) {
        const letter = latestFound[j].toLowerCase();
        // Check if this letter is the latest remaining available letter
        const latestRemaining = Array.from(remaining).sort((a, b) =>
          b.localeCompare(a)
        )[0];
        if (letter === latestRemaining) {
          reveal++;
          remaining.delete(letter);
        } else {
          break; // Stop if letter doesn't match
        }
      }
    }

    if (reveal > 0) {
      hints.set(word, reveal);
    }
  }

  return hints;
}

// Test utilities
function test(description: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${description}`);
  } catch (e) {
    console.error(`❌ ${description}`);
    console.error(`   ${(e as Error).message}`);
    process.exit(1);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

test("no hints when no words found", () => {
  const words = ["apple", "banana", "cherry"];
  const found = new Set<string>();
  const available = new Set(["a", "b", "c", "e", "n", "p"]);

  const hints = computeHintReveals(words, found, available);
  assert.strictEqual(hints.size, 0);
});

test("common prefix between two found words", () => {
  const words = ["bad", "bag", "ban", "bat", "bug"];
  const found = new Set(["bad", "bug"]);
  const available = new Set(["a", "b", "d", "g", "n", "t", "u"]);

  const hints = computeHintReveals(words, found, available);

  // Words between "bad" and "bug"
  assert.strictEqual(hints.get("bag"), 1); // "ba" is common
  assert.strictEqual(hints.get("ban"), 1); // "ba" is common
  assert.strictEqual(hints.get("bat"), 1); // "ba" is common
});

test("longer common prefix", () => {
  const words = ["undone", "under", "unfold", "unsafe", "unsure"];
  const found = new Set(["undone", "unsure"]);
  const available = new Set(["a", "d", "e", "f", "n", "o", "r", "s", "u"]);

  const hints = computeHintReveals(words, found, available);

  // "un" is common to "undone" and "unsure"
  assert.strictEqual(hints.get("under"), 2);
  assert.strictEqual(hints.get("unfold"), 2);
  assert.strictEqual(hints.get("unsafe"), 2);
});

test("hints before earliest word (basic case)", () => {
  // If "game" is found and is the earliest
  // Available: {a, e, g, i, m, r}
  // For words before "game", we can deduce:
  // - "game" starts with 'g'
  // - Earlier available letters: a, e
  // - Only 'a' comes before 'g', so show 1 letter
  const words = ["able", "acre", "game", "gate"];
  const found = new Set(["game"]);
  const available = new Set(["a", "e", "g", "i", "m", "r"]);

  const hints = computeHintReveals(words, found, available);

  // "game" starts with 'g'
  // Available before 'g': a, e
  // First letter of "game" is 'g', not in {a, e}
  // So... reveal 0? Or do we show 'a' as the earliest available?
  // Based on user's description, we should show 0 here

  // Actually, re-reading the user's comment:
  // "If the earliest word starts with the first letter alphabetically"
  // "about" vs available {a, b, c, e, g, i, m, r}
  // First letter alphabetically: 'a'
  // Does "about" start with 'a'? Yes → show 1 letter
  // Remove 'a', next earliest: 'b'
  // Does "about"[1] = 'b' match 'b'? Yes → show 2 letters
  // Continue: "about"[2] = 'o', not in remaining available → stop

  // So for this test:
  const words2 = ["about", "badge", "game", "gate"];
  const found2 = new Set(["game"]);
  const available2 = new Set(["a", "b", "d", "e", "g", "m"]);

  const hints2 = computeHintReveals(words2, found2, available2);

  // "game" starts with 'g'
  // Available before 'g' (alphabetically): a, b, d, e
  // Earliest: 'a'
  // "game"[0] = 'g', not 'a'
  // So reveal 0

  assert.strictEqual(hints2.get("about"), undefined);
  assert.strictEqual(hints2.get("badge"), undefined);
});

test("hints before earliest word (matching start letters)", () => {
  // If "about" is found and is the earliest
  // Available: {a, b, c, e, g, i, m, r}
  // For words before "about":
  // - Check if 'a' (first letter of "about") matches first available letter
  // - First available: 'a' → Yes, show 1
  // - Remove 'a', next available: 'b'
  // - Check if 'b' (second letter of "about") matches first remaining 'b'
  // - Yes → show 2
  // - Remove 'b', next available: 'c'
  // - Check if 'o' (third letter of "about") matches first remaining 'c'
  // - No → stop at 2

  const words = ["aardvark", "abbey", "about", "badge"];
  const found = new Set(["about"]);
  const available = new Set(["a", "b", "c", "d", "e", "g", "m", "o", "r"]);

  const hints = computeHintReveals(words, found, available);

  // First letter of "about" is 'a', first available is 'a' → match, reveal 1
  // Second letter of "about" is 'b', first remaining is 'b' → match, reveal 2
  // Third letter of "about" is 'o', first remaining is 'c' → no match, stop
  assert.strictEqual(hints.get("aardvark"), 2);
  assert.strictEqual(hints.get("abbey"), 2);
});

test("hints after latest word (matching start letters vs latest available)", () => {
  // Words after latest found word show letters matching the latest word's start
  // against the LATEST available letters (reverse sort)

  // Example 1: "wad" found, available {a, d, e, t, w}
  // - "wad"[0] = 'w'
  // - Latest available (reverse): w, t, e, d, a
  // - First: 'w' == 'w' → reveal 1
  // - "wad"[1] = 'a', remaining {t, e, d, a}, latest: 't'
  // - 'a' != 't' → stop at 1
  const words = ["wad", "wage", "wait", "wave"];
  const found = new Set(["wad"]);
  const available = new Set(["a", "d", "e", "t", "w"]);

  const hints = computeHintReveals(words, found, available);

  assert.strictEqual(hints.get("wage"), 1);
  assert.strictEqual(hints.get("wait"), 1);
  assert.strictEqual(hints.get("wave"), 1);

  // Example 2: "and" found, available {a, b, c, d, n}
  // - "and"[0] = 'a'
  // - Latest available (reverse): n, d, c, b, a
  // - First: 'n' != 'a' → stop at 0
  const words2 = ["and", "any", "arc"];
  const found2 = new Set(["and"]);
  const available2 = new Set(["a", "b", "c", "d", "n"]);

  const hints2 = computeHintReveals(words2, found2, available2);

  assert.strictEqual(hints2.get("any"), undefined);
  assert.strictEqual(hints2.get("arc"), undefined);

  // Example 3: "tab" found, available {a, b, d, g, r, s, t}
  // - "tab"[0] = 't'
  // - Latest available (reverse): t, s, r, g, d, b, a
  // - First: 't' == 't' → reveal 1
  // - "tab"[1] = 'a', remaining {s, r, g, d, b, a}, latest: 's'
  // - 'a' != 's' → stop at 1
  const words3 = ["sap", "sat", "tab", "tag", "tar"];
  const found3 = new Set(["tab"]);
  const available3 = new Set(["a", "b", "d", "g", "r", "s", "t"]);

  const hints3 = computeHintReveals(words3, found3, available3);

  assert.strictEqual(hints3.get("tag"), 1);
  assert.strictEqual(hints3.get("tar"), 1);
});

test("real scenario: found TAB - shows T for words after it", () => {
  // When "tab" is found:
  // Words BEFORE (sap, sat): earliest available is 'a', "tab"[0] = 't' != 'a' → no hint
  // Words AFTER (tad, tag, tar): latest available is 't', "tab"[0] = 't' == 't' → reveal 1
  const words = ["sap", "sat", "tab", "tad", "tag", "tar"];
  const found = new Set(["tab"]);
  const available = new Set(["a", "b", "d", "g", "r", "s", "t"]);

  const hints = computeHintReveals(words, found, available);

  // Words before "tab": sap, sat
  assert.strictEqual(hints.get("sap"), undefined);
  assert.strictEqual(hints.get("sat"), undefined);

  // Words after "tab": tad, tag, tar
  // Latest available (reverse): t, s, r, g, d, b, a
  // "tab"[0] = 't' == 't' → reveal 1
  assert.strictEqual(hints.get("tad"), 1);
  assert.strictEqual(hints.get("tag"), 1);
  assert.strictEqual(hints.get("tar"), 1);
});

console.log("\n✅ All hint reveal tests passed!");
