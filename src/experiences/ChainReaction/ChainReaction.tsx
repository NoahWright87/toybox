import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import rawWords from "../../data/words/wordlist-clean.txt?raw";
import rawMetadata from "../../data/words/word-metadata.json";
import "./ChainReaction.css";

// ── Word filtering ────────────────────────────────────────────────────────────

const metadata = rawMetadata as Record<string, { difficulty: number; length: number }>;

function wordDifficulty(word: string): number {
  return metadata[word]?.difficulty ?? 50;
}

type WordRarity = "common" | "uncommon" | "all";

const RARITY_MAX: Record<WordRarity, number | undefined> = {
  common: 45,
  uncommon: 70,
  all: undefined,
};

let _baseWords: string[] | null = null;
const _filteredWords: Partial<Record<WordRarity, string[]>> = {};
const _filteredIndex: Partial<Record<WordRarity, Map<string, string[]>>> = {};

function getBaseWords(): string[] {
  if (!_baseWords) {
    _baseWords = rawWords
      .split("\n")
      .map((w) => w.trim())
      .filter((w) => w.length >= 4 && /^[a-z]+$/.test(w));
  }
  return _baseWords!;
}

function getWords(rarity: WordRarity): string[] {
  if (!_filteredWords[rarity]) {
    const maxD = RARITY_MAX[rarity];
    _filteredWords[rarity] =
      maxD === undefined
        ? getBaseWords()
        : getBaseWords().filter((w) => wordDifficulty(w) <= maxD);
  }
  return _filteredWords[rarity]!;
}

function getIndex(rarity: WordRarity): Map<string, string[]> {
  if (!_filteredIndex[rarity]) {
    const index = new Map<string, string[]>();
    for (const word of getWords(rarity)) {
      const fl = word[0];
      if (!index.has(fl)) index.set(fl, []);
      index.get(fl)!.push(word);
    }
    _filteredIndex[rarity] = index;
  }
  return _filteredIndex[rarity]!;
}

// ── Chain building ────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildChain(targetLength: number, rarity: WordRarity): string[] | null {
  const words = getWords(rarity);
  const index = getIndex(rarity);
  for (let attempt = 0; attempt < 300; attempt++) {
    const start = words[Math.floor(Math.random() * words.length)];
    const chain: string[] = [start];
    const used = new Set<string>([start]);
    if (dfs(chain, used, targetLength, index)) return chain;
  }
  return null;
}

function dfs(
  chain: string[],
  used: Set<string>,
  target: number,
  index: Map<string, string[]>
): boolean {
  if (chain.length === target) return true;
  const last = chain[chain.length - 1];
  const lastLetter = last[last.length - 1];
  const candidates = index.get(lastLetter) ?? [];
  for (const w of shuffle(candidates).slice(0, 30)) {
    if (!used.has(w)) {
      chain.push(w);
      used.add(w);
      if (dfs(chain, used, target, index)) return true;
      chain.pop();
      used.delete(w);
    }
  }
  return false;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type GamePhase = "setup" | "playing" | "won" | "lost";
type ChainLength = 4 | 5 | 6 | 7 | 8;

interface ChainWord {
  word: string;
  // positions revealed through player guessing
  revealed: boolean[];
  // first letter given for free once previous word is complete
  unlocked: boolean;
  isStart: boolean;
  isEnd: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_MISTAKES = 6;
const POINTS_PER_LETTER = 50;
const SOLVE_BONUS = 300;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

// ── Chain helpers ─────────────────────────────────────────────────────────────

// Is position i currently visible (either guessed or given as a connector)?
function isShown(cw: ChainWord, i: number): boolean {
  if (cw.isStart || cw.isEnd) return true;
  return cw.revealed[i] || (i === 0 && cw.unlocked);
}

// Is the word fully revealed (every position visible)?
function isComplete(cw: ChainWord): boolean {
  if (cw.isStart || cw.isEnd) return true;
  return cw.word.split("").every((_, i) => isShown(cw, i));
}

// Propagate first-letter unlocks: whenever a word is complete, give the next
// word's first letter for free.  Loop until stable (cascade effect).
function cascadeUnlocks(chain: ChainWord[]): ChainWord[] {
  const result = chain.map((cw) => ({ ...cw, revealed: [...cw.revealed] }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < result.length - 1; i++) {
      if (!result[i].unlocked && isComplete(result[i - 1])) {
        result[i] = { ...result[i], unlocked: true };
        changed = true;
      }
    }
  }
  return result;
}

function makeChain(words: string[]): ChainWord[] {
  const raw: ChainWord[] = words.map((word, i) => ({
    word,
    revealed: Array(word.length).fill(false) as boolean[],
    unlocked: false,
    isStart: i === 0,
    isEnd: i === words.length - 1,
  }));
  // Start and end words are fully revealed
  const withEnds = raw.map((cw) =>
    cw.isStart || cw.isEnd
      ? { ...cw, revealed: Array(cw.word.length).fill(true) as boolean[] }
      : cw
  );
  // Propagate: START being complete unlocks first letter of inner word 1
  return cascadeUnlocks(withEnds);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ChainReactionProps {
  onQuit: () => void;
}

export default function ChainReaction({ onQuit }: ChainReactionProps) {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [chainLength, setChainLength] = useState<ChainLength>(6);
  const [rarity, setRarity] = useState<WordRarity>("common");
  const [chain, setChain] = useState<ChainWord[]>([]);
  const [correctGuesses, setCorrectGuesses] = useState<Set<string>>(new Set<string>());
  const [wrongGuesses, setWrongGuesses] = useState<Set<string>>(new Set<string>());
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);

  const chainLengthRef = useRef<ChainLength>(chainLength);
  chainLengthRef.current = chainLength;
  const rarityRef = useRef<WordRarity>(rarity);
  rarityRef.current = rarity;

  const startGame = useCallback((length?: ChainLength, rar?: WordRarity) => {
    const len = length ?? chainLengthRef.current;
    const r = rar ?? rarityRef.current;
    const words = buildChain(len, r);
    if (!words) return;
    setChain(makeChain(words));
    setCorrectGuesses(new Set<string>());
    setWrongGuesses(new Set<string>());
    setMistakes(0);
    setScore(0);
    setPhase("playing");
  }, []);

  const handleGuess = useCallback(
    (letter: string) => {
      if (phase !== "playing") return;
      if (correctGuesses.has(letter) || wrongGuesses.has(letter)) return;

      let tilesRevealed = 0;
      const afterGuess = chain.map((cw) => {
        if (cw.isStart || cw.isEnd) return cw;
        let anyNew = false;
        const newRevealed = cw.revealed.map((r, i) => {
          if (r) return true;
          // Only count/reveal positions that aren't already visible
          if (!isShown(cw, i) && cw.word[i] === letter) {
            tilesRevealed++;
            anyNew = true;
            return true;
          }
          return false;
        });
        return anyNew ? { ...cw, revealed: newRevealed } : cw;
      });

      const afterCascade = cascadeUnlocks(afterGuess);

      if (tilesRevealed > 0) {
        setCorrectGuesses((prev) => new Set<string>([...prev, letter]));
        setChain(afterCascade);
        const gained = tilesRevealed * POINTS_PER_LETTER;
        const allDone = afterCascade
          .filter((cw) => !cw.isStart && !cw.isEnd)
          .every((cw) => isComplete(cw));
        if (allDone) {
          setScore((prev) => prev + gained + SOLVE_BONUS);
          setPhase("won");
        } else {
          setScore((prev) => prev + gained);
        }
      } else {
        setWrongGuesses((prev) => new Set<string>([...prev, letter]));
        const newMistakes = mistakes + 1;
        setMistakes(newMistakes);
        if (newMistakes >= MAX_MISTAKES) {
          // Reveal full chain on loss
          setChain(
            afterCascade.map((cw) => ({
              ...cw,
              revealed: Array(cw.word.length).fill(true) as boolean[],
              unlocked: true,
            }))
          );
          setPhase("lost");
        }
      }
    },
    [phase, correctGuesses, wrongGuesses, chain, mistakes]
  );

  // Keyboard input
  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e: KeyboardEvent) => {
      const letter = e.key.toLowerCase();
      if (/^[a-z]$/.test(letter)) handleGuess(letter);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, handleGuess]);

  const menus = useMemo<MenuBarMenu[]>(
    () => [
      {
        label: "Game",
        items: [
          { label: "New Game", onClick: () => startGame() },
          { separator: true },
          {
            label: "Short Chain (4 words)",
            checked: chainLength === 4,
            onClick: () => { setChainLength(4); startGame(4); },
          },
          {
            label: "Medium Chain (6 words)",
            checked: chainLength === 6,
            onClick: () => { setChainLength(6); startGame(6); },
          },
          {
            label: "Long Chain (8 words)",
            checked: chainLength === 8,
            onClick: () => { setChainLength(8); startGame(8); },
          },
          { separator: true },
          {
            label: "Words: Common",
            checked: rarity === "common",
            onClick: () => { setRarity("common"); startGame(undefined, "common"); },
          },
          {
            label: "Words: Uncommon",
            checked: rarity === "uncommon",
            onClick: () => { setRarity("uncommon"); startGame(undefined, "uncommon"); },
          },
          {
            label: "Words: All",
            checked: rarity === "all",
            onClick: () => { setRarity("all"); startGame(undefined, "all"); },
          },
          { separator: true },
          { label: "Quit", onClick: onQuit },
        ],
      },
    ],
    [chainLength, rarity, startGame, onQuit]
  );
  useWindowMenus(menus);

  // ── Setup screen ─────────────────────────────────────────────────────────────

  if (phase === "setup") {
    return (
      <div className="cr">
        <div className="cr__setup">
          <div className="cr__setup-title">CHAIN REACTION</div>
          <p className="cr__setup-desc">
            Guess letters to reveal hidden words. Each word&apos;s last letter is
            the first letter of the next — forming a chain from{" "}
            <span className="cr__setup-start">START</span> to{" "}
            <span className="cr__setup-end">END</span>.
          </p>
          <div className="cr__setup-row">
            <span className="cr__setup-label">Chain:</span>
            <div className="cr__setup-options">
              {([4, 5, 6, 7, 8] as ChainLength[]).map((len) => (
                <button
                  key={len}
                  className={`cr__setup-btn${chainLength === len ? " cr__setup-btn--active" : ""}`}
                  onClick={() => setChainLength(len)}
                >
                  {len}
                </button>
              ))}
            </div>
          </div>
          <div className="cr__setup-row">
            <span className="cr__setup-label">Words:</span>
            <div className="cr__setup-options">
              {(["common", "uncommon", "all"] as WordRarity[]).map((r) => (
                <button
                  key={r}
                  className={`cr__setup-btn${rarity === r ? " cr__setup-btn--active" : ""}`}
                  onClick={() => setRarity(r)}
                >
                  {r === "common" ? "EASY" : r === "uncommon" ? "HARD" : "ALL"}
                </button>
              ))}
            </div>
          </div>
          <button className="cr__start-btn" onClick={() => startGame()}>
            ▶ NEW GAME
          </button>
        </div>
      </div>
    );
  }

  // ── Playing / result screen ───────────────────────────────────────────────────

  const allGuessed = new Set<string>([...correctGuesses, ...wrongGuesses]);

  return (
    <div className="cr">
      {/* Status bar */}
      <div className="cr__status">
        <div className="cr__lives">
          {Array.from({ length: MAX_MISTAKES }, (_, i) => (
            <span key={i} className={`cr__life${i < mistakes ? " cr__life--lost" : ""}`}>
              {i < mistakes ? "✕" : "♥"}
            </span>
          ))}
        </div>
        <div className="cr__score">Score: {score}</div>
      </div>

      {/* Chain */}
      <div className="cr__chain">
        {chain.map((cw, wi) => (
          <div key={wi} className="cr__word-group">
            <div className="cr__word-row">
              <span
                className={`cr__word-tag${cw.isStart ? " cr__word-tag--start" : cw.isEnd ? " cr__word-tag--end" : ""}`}
              >
                {cw.isStart ? "START" : cw.isEnd ? "END" : ""}
              </span>
              <div className="cr__letters">
                {cw.word.split("").map((letter, li) => {
                  const shown = isShown(cw, li);
                  // "given" = shown via cascade unlock, not via player guessing
                  const isGiven =
                    !cw.isStart && !cw.isEnd && li === 0 && cw.unlocked && !cw.revealed[li];
                  const cls = [
                    "cr__cell",
                    cw.isStart
                      ? "cr__cell--start"
                      : cw.isEnd
                      ? "cr__cell--end"
                      : shown
                      ? isGiven
                        ? "cr__cell--connector"
                        : "cr__cell--guessed"
                      : "cr__cell--hidden",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <span key={li} className={cls}>
                      {shown ? letter.toUpperCase() : ""}
                    </span>
                  );
                })}
              </div>
            </div>
            {wi < chain.length - 1 && <div className="cr__arrow">↓</div>}
          </div>
        ))}
      </div>

      {/* Result banner */}
      {(phase === "won" || phase === "lost") && (
        <div className={`cr__result cr__result--${phase === "won" ? "won" : "lost"}`}>
          <span className="cr__result-text">
            {phase === "won" ? "CHAIN SOLVED!" : "CHAIN BROKEN!"}
          </span>
          <span className="cr__result-score">Final score: {score}</span>
          <button className="cr__start-btn" onClick={() => startGame()}>
            ▶ NEW GAME
          </button>
        </div>
      )}

      {/* On-screen keyboard */}
      {phase === "playing" && (
        <div className="cr__keyboard">
          {ALPHABET.map((letter) => (
            <button
              key={letter}
              className={[
                "cr__key",
                correctGuesses.has(letter) ? "cr__key--correct" : "",
                wrongGuesses.has(letter) ? "cr__key--wrong" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleGuess(letter)}
              disabled={allGuessed.has(letter)}
            >
              {letter.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
