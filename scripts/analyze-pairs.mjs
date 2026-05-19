#!/usr/bin/env node
// Analyzes src/experiences/ChainReaction/pairs.ts for connectivity gaps.
// A word needs outgoing edges (appears as `a`) to grow a chain forward,
// and incoming edges (appears as `b`) to grow a chain backward.
// Words with few edges in either direction are candidates for more pairs.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, "../src/experiences/ChainReaction/pairs.ts"), "utf8");

// Parse pairs by extracting { a: "...", b: "...", explanation: "..." } objects
const pairRe = /\{\s*a:\s*"([^"]+)"\s*,\s*b:\s*"([^"]+)"\s*,\s*explanation:\s*"([^"]+)"\s*\}/g;
const pairs = [];
let m;
while ((m = pairRe.exec(src)) !== null) {
  pairs.push({ a: m[1], b: m[2], explanation: m[3] });
}

console.log(`Total pairs: ${pairs.length}\n`);

// Build maps
const outgoing = new Map(); // word → count of pairs where word is `a`
const incoming = new Map(); // word → count of pairs where word is `b`
const allWords = new Set();

for (const p of pairs) {
  allWords.add(p.a);
  allWords.add(p.b);
  outgoing.set(p.a, (outgoing.get(p.a) ?? 0) + 1);
  incoming.set(p.b, (incoming.get(p.b) ?? 0) + 1);
}

// Collect stats per word
const stats = Array.from(allWords).map(w => ({
  word: w,
  out: outgoing.get(w) ?? 0,
  in:  incoming.get(w) ?? 0,
}));

// Sort by worst connectivity first (min of in/out)
stats.sort((a, b) => Math.min(a.out, a.in) - Math.min(b.out, b.in) || a.word.localeCompare(b.word));

// ── Structural issues ─────────────────────────────────────────────────────

const deadEnds      = stats.filter(s => s.out === 0);
const deadStarts    = stats.filter(s => s.in === 0);
const lowOut        = stats.filter(s => s.out > 0 && s.out < 3);
const lowIn         = stats.filter(s => s.in > 0 && s.in < 3);
const isolatedEnds  = stats.filter(s => s.out === 0 && s.in >= 1);
const isolatedStarts= stats.filter(s => s.in === 0 && s.out >= 1);

console.log("═══════════════════════════════════════════════════════════");
console.log("DEAD ENDS — appear only as `b` (chain stops here, can't grow forward)");
console.log("═══════════════════════════════════════════════════════════");
if (deadEnds.length === 0) {
  console.log("  (none)");
} else {
  for (const s of deadEnds) {
    const sources = pairs.filter(p => p.b === s.word).map(p => p.a).join(", ");
    console.log(`  ${s.word.padEnd(14)} ← from: ${sources}`);
  }
}

console.log();
console.log("═══════════════════════════════════════════════════════════");
console.log("ORPHAN STARTS — appear only as `a` (can start but nothing leads here)");
console.log("═══════════════════════════════════════════════════════════");
if (isolatedStarts.length === 0) {
  console.log("  (none)");
} else {
  for (const s of isolatedStarts) {
    const targets = pairs.filter(p => p.a === s.word).map(p => p.b).join(", ");
    console.log(`  ${s.word.padEnd(14)} → to:   ${targets}`);
  }
}

console.log();
console.log("═══════════════════════════════════════════════════════════");
console.log("LOW OUTGOING (1–2 forward edges) — hard to grow chains forward from here");
console.log("═══════════════════════════════════════════════════════════");
for (const s of lowOut) {
  const targets = pairs.filter(p => p.a === s.word).map(p => p.b).join(", ");
  console.log(`  ${s.word.padEnd(14)} out=${s.out}  in=${s.in}   → ${targets}`);
}

console.log();
console.log("═══════════════════════════════════════════════════════════");
console.log("LOW INCOMING (1–2 backward edges) — hard to grow chains backward to here");
console.log("═══════════════════════════════════════════════════════════");
for (const s of lowIn) {
  const sources = pairs.filter(p => p.b === s.word).map(p => p.a).join(", ");
  console.log(`  ${s.word.padEnd(14)} out=${s.out}  in=${s.in}   ← ${sources}`);
}

console.log();
console.log("═══════════════════════════════════════════════════════════");
console.log("SUMMARY");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Total words:      ${allWords.size}`);
console.log(`  Total pairs:      ${pairs.length}`);
console.log(`  Dead ends:        ${deadEnds.length}  (only appear as b)`);
console.log(`  Orphan starts:    ${isolatedStarts.length}  (only appear as a)`);
console.log(`  Low outgoing <3:  ${lowOut.length}`);
console.log(`  Low incoming <3:  ${lowIn.length}`);
console.log();

// ── Accurate generator simulation (matches chainUtils.ts) ─────────────────
// Runs the actual forward-then-backward algorithm for each seed word and
// counts how many distinct valid chains of each length can be produced.

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tryBuild(seed, targetLength) {
  const words = [seed];
  const chain = [];

  // Grow forward
  while (words.length < targetLength) {
    const last = words[words.length - 1];
    const candidates = pairs.filter(p => p.a === last && !words.includes(p.b));
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    words.push(pick.b);
    chain.push(pick);
  }

  if (words.length === targetLength) return words;

  // Grow backward
  while (words.length < targetLength) {
    const first = words[0];
    const candidates = pairs.filter(p => p.b === first && !words.includes(p.a));
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    words.unshift(pick.a);
    chain.unshift(pick);
  }

  return words.length === targetLength ? words : null;
}

function simulateGeneration(targetLen, trials = 200) {
  const seeds = Array.from(outgoing.keys());
  let successes = 0;
  const examples = [];

  for (let i = 0; i < trials; i++) {
    const seed = seeds[Math.floor(Math.random() * seeds.length)];
    const result = tryBuild(seed, targetLen);
    if (result) {
      successes++;
      if (examples.length < 3) examples.push(result.join(" → "));
    }
  }

  return { successes, trials, rate: (successes / trials * 100).toFixed(0), examples };
}

console.log("Generator simulation (200 random trials each):");
for (const [label, len] of [["Quick (4)", 4], ["Normal (6)", 6], ["Long (8)", 8]]) {
  const { successes, trials, rate, examples } = simulateGeneration(len);
  console.log(`\n  ${label}: ${successes}/${trials} succeed (${rate}%)`);
  for (const ex of examples) console.log(`    e.g. ${ex}`);
}
console.log();
