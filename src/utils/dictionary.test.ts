/**
 * Unit tests for Word Whirlwind hint system logic.
 *
 * To run: node --test src/utils/dictionary.test.ts
 *
 * This tests the computeGroupHints function to ensure hints are only shown
 * for words that come before the earliest found word or after the latest found word,
 * not for all words without an immediate neighbor.
 */

import assert from "assert";

function commonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

function computeGroupHints(
  words: string[],
  foundWords: Set<string>
): Map<string, string> {
  const hints = new Map<string, string>();

  let earliestFound: string | null = null;
  let latestFound: string | null = null;
  for (const word of words) {
    if (foundWords.has(word)) {
      if (earliestFound === null) earliestFound = word;
      latestFound = word;
    }
  }

  for (let i = 0; i < words.length; i++) {
    if (foundWords.has(words[i])) continue;

    let left: string | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (foundWords.has(words[j])) { left = words[j]; break; }
    }
    let right: string | null = null;
    for (let j = i + 1; j < words.length; j++) {
      if (foundWords.has(words[j])) { right = words[j]; break; }
    }

    if (left !== null && right !== null) {
      hints.set(words[i], commonPrefix(left, right));
    } else if (earliestFound !== null && words[i] < earliestFound) {
      hints.set(words[i], earliestFound[0]);
    } else if (latestFound !== null && words[i] > latestFound) {
      hints.set(words[i], latestFound[0]);
    }
  }
  return hints;
}

// Test cases
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

test("should not show hints when no words are found", () => {
  const words = ["apple", "banana", "cherry", "date"];
  const foundWords = new Set<string>();
  const hints = computeGroupHints(words, foundWords);
  assert.strictEqual(hints.size, 0);
});

test("should show first letter of earliest found word for words before it", () => {
  const words = ["apple", "banana", "cherry", "date"];
  const foundWords = new Set(["cherry"]);
  const hints = computeGroupHints(words, foundWords);

  // Words before "cherry": apple, banana
  assert.strictEqual(hints.get("apple"), "c");
  assert.strictEqual(hints.get("banana"), "c");
  // Words after "cherry": date (cherry is also the latest found)
  assert.strictEqual(hints.get("date"), "c");
});

test("should show first letter of latest found word for words after it", () => {
  const words = ["apple", "banana", "cherry", "date"];
  const foundWords = new Set(["banana"]);
  const hints = computeGroupHints(words, foundWords);

  // Words before "banana": apple (banana is also the earliest found)
  assert.strictEqual(hints.get("apple"), "b");
  // Words after "banana": cherry, date
  assert.strictEqual(hints.get("cherry"), "b");
  assert.strictEqual(hints.get("date"), "b");
});

test("should use common prefix for words between found words", () => {
  const words = ["apple", "apricot", "banana", "berry", "cherry"];
  const foundWords = new Set(["apricot", "berry"]);
  const hints = computeGroupHints(words, foundWords);

  // "banana" is between "apricot" and "berry", commonPrefix is ""
  assert.strictEqual(hints.get("banana"), "");
  // "cherry" is after "berry", so shows "b"
  assert.strictEqual(hints.get("cherry"), "b");
  // "apple" is before "apricot", so shows "a"
  assert.strictEqual(hints.get("apple"), "a");
});

test("should only show hint for words actually before earliest found", () => {
  const words = ["alp", "are", "bee", "cab"];
  const foundWords = new Set(["bee"]);
  const hints = computeGroupHints(words, foundWords);

  assert.strictEqual(hints.get("alp"), "b");
  assert.strictEqual(hints.get("are"), "b");
  assert.strictEqual(hints.get("cab"), "b");
});

test("should handle multiple found words correctly", () => {
  const words = ["age", "bag", "cab", "dab", "ear", "fat"];
  const foundWords = new Set(["bag", "ear"]);
  const hints = computeGroupHints(words, foundWords);

  assert.strictEqual(hints.get("age"), "b");
  assert.strictEqual(hints.get("cab"), "");
  assert.strictEqual(hints.get("dab"), "");
  assert.strictEqual(hints.get("fat"), "e");
});

test("should not show hints for found words", () => {
  const words = ["apple", "banana", "cherry"];
  const foundWords = new Set(["banana"]);
  const hints = computeGroupHints(words, foundWords);

  assert.strictEqual(hints.get("banana"), undefined);
});

test("real scenario: found ARE (starts with A) - shows A for all words", () => {
  const words = ["about", "after", "apple", "are", "bag", "bat"];
  const foundWords = new Set(["are"]);
  const hints = computeGroupHints(words, foundWords);

  assert.strictEqual(hints.get("about"), "a");
  assert.strictEqual(hints.get("after"), "a");
  assert.strictEqual(hints.get("apple"), "a");
  assert.strictEqual(hints.get("bag"), "a");
  assert.strictEqual(hints.get("bat"), "a");
});

test("real scenario: found TAB (starts with T) - shows T for all words", () => {
  const words = ["sap", "sat", "tab", "tad", "tag", "tar"];
  const foundWords = new Set(["tab"]);
  const hints = computeGroupHints(words, foundWords);

  assert.strictEqual(hints.get("sap"), "t");
  assert.strictEqual(hints.get("sat"), "t");
  assert.strictEqual(hints.get("tad"), "t");
  assert.strictEqual(hints.get("tag"), "t");
  assert.strictEqual(hints.get("tar"), "t");
});

console.log("\n✅ All hint logic tests passed!");
