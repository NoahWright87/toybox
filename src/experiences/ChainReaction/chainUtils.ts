import { PAIRS, type Pair } from "./pairs";

export interface ChainResult {
  words: string[];
  pairs: Pair[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build forward adjacency map: word → pairs where pair.a === word
function buildForwardMap(): Map<string, Pair[]> {
  const m = new Map<string, Pair[]>();
  for (const p of PAIRS) {
    if (!m.has(p.a)) m.set(p.a, []);
    m.get(p.a)!.push(p);
  }
  return m;
}

// Build backward adjacency map: word → pairs where pair.b === word
function buildBackwardMap(): Map<string, Pair[]> {
  const m = new Map<string, Pair[]>();
  for (const p of PAIRS) {
    if (!m.has(p.b)) m.set(p.b, []);
    m.get(p.b)!.push(p);
  }
  return m;
}

// Attempt to build a chain of exactly `targetLength` words.
// Strategy:
//   1. Grow forward from a seed word.
//   2. If forward growth hits a dead end, try growing backward from the current start.
//   3. Avoid re-visiting words already in the chain.
export function generateChain(targetLength: number, usedSeeds: Set<string>): ChainResult | null {
  const fwd = buildForwardMap();
  const bwd = buildBackwardMap();

  // Collect all possible seed words (those that appear as `a` with enough neighbors)
  const seeds = shuffle(
    Array.from(fwd.keys()).filter(w => !usedSeeds.has(w))
  );

  if (seeds.length === 0) return null;

  for (const seed of seeds) {
    const result = tryBuild(seed, targetLength, fwd, bwd);
    if (result) return result;
  }
  return null;
}

function tryBuild(
  seed: string,
  targetLength: number,
  fwd: Map<string, Pair[]>,
  bwd: Map<string, Pair[]>
): ChainResult | null {
  const words: string[] = [seed];
  const pairs: Pair[] = [];

  // Grow forward until we reach targetLength or get stuck
  while (words.length < targetLength) {
    const last = words[words.length - 1];
    const candidates = shuffle(
      (fwd.get(last) ?? []).filter(p => !words.includes(p.b))
    );
    if (candidates.length === 0) break;
    const pick = candidates[0];
    words.push(pick.b);
    pairs.push(pick);
  }

  if (words.length === targetLength) return { words, pairs };

  // Forward growth stalled — try extending backward from the start
  while (words.length < targetLength) {
    const first = words[0];
    const candidates = shuffle(
      (bwd.get(first) ?? []).filter(p => !words.includes(p.a))
    );
    if (candidates.length === 0) return null; // truly stuck
    const pick = candidates[0];
    words.unshift(pick.a);
    pairs.unshift(pick);
  }

  return words.length === targetLength ? { words, pairs } : null;
}
