/**
 * Hint system for Word Whirlwind.
 *
 * The hint system shows letters based on what the player can deduce from:
 * 1. The common prefix between bracketing found words (for words in between)
 * 2. The available letters and the earliest found word (for words before it)
 * 3. The available letters and the latest found word (for words after it)
 */

/**
 * Compute how many letters should be revealed as a hint for each word.
 *
 * @param allWords - All words in sorted order
 * @param foundWords - Set of guessed/found words
 * @param availableLetters - The letters available in the puzzle
 * @returns Map from word -> number of letters to reveal as hint
 */
export function computeHintReveals(
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
      // Same logic but in reverse (from end of latestFound word)
      const availableArray = Array.from(availableLetters)
        .map((x) => x.toLowerCase())
        .sort((a, b) => b.localeCompare(a)); // Reverse sort
      const remaining = new Set(availableArray);

      for (let j = latestFound.length - 1; j >= 0; j--) {
        const letter = latestFound[j].toLowerCase();
        // Check if this letter is the latest remaining available letter (in reverse order)
        const latestRemaining = Array.from(remaining).sort((a, b) =>
          b.localeCompare(a)
        )[0];
        if (letter === latestRemaining) {
          reveal++;
          remaining.delete(letter);
        } else {
          break;
        }
      }
    }

    if (reveal > 0) {
      hints.set(word, reveal);
    }
  }

  return hints;
}
