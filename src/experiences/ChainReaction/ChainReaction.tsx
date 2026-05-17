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

type GamePhase = "setup" | "playing" | "won";
type ChainLength = 4 | 5 | 6 | 7 | 8;
type Feedback = "idle" | "wrong" | "badstart";

// ── Constants ─────────────────────────────────────────────────────────────────

const PPL = 100;       // points per unrevealed letter on correct guess
const WRONG_PEN = 30;  // penalty per wrong guess

// ── Scoring helper ────────────────────────────────────────────────────────────

// How many letters are still unknown (score-worthy) when the player guesses correctly?
// revealedSoFar = currentRevealed + 1 (the given first letter counts as revealed)
// For the last inner word, the trailing last letter is also given, so subtract 1 more.
function hiddenLetters(word: string, revealedSoFar: number, isLastInner: boolean): number {
  const givenCount = isLastInner ? 2 : 1; // first letter + (maybe) last letter
  return Math.max(0, word.length - givenCount - (revealedSoFar - 1));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ChainReactionProps {
  onQuit: () => void;
}

export default function ChainReaction({ onQuit }: ChainReactionProps) {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [chainLength, setChainLength] = useState<ChainLength>(6);
  const [rarity, setRarity] = useState<WordRarity>("common");

  // Core game state
  const [chain, setChain] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(1); // index into chain currently being solved
  const [currentRevealed, setCurrentRevealed] = useState(0); // extra letters revealed by wrong guesses
  const [score, setScore] = useState(0);
  const [wrongTotal, setWrongTotal] = useState(0);

  // Input state
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<Feedback>("idle");

  const chainLengthRef = useRef(chainLength);
  chainLengthRef.current = chainLength;
  const rarityRef = useRef(rarity);
  rarityRef.current = rarity;
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const startGame = useCallback((length?: ChainLength, rar?: WordRarity) => {
    const len = length ?? chainLengthRef.current;
    const r = rar ?? rarityRef.current;
    const words = buildChain(len, r);
    if (!words) return;
    setChain(words);
    setCurrentIdx(1);
    setCurrentRevealed(0);
    setScore(0);
    setWrongTotal(0);
    setGuess("");
    setFeedback("idle");
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const submitGuess = useCallback(() => {
    if (phase !== "playing") return;
    const normalized = guess.trim().toLowerCase();
    if (!normalized) return;

    const activeWord = chain[currentIdx];
    const firstLetter = activeWord[0];

    if (normalized[0] !== firstLetter) {
      setFeedback("badstart");
      return;
    }

    if (normalized === activeWord) {
      // ── Correct guess ──────────────────────────────────────────────────────
      const isLastInner = currentIdx === chain.length - 2;
      const revealedSoFar = currentRevealed + 1;
      const gained = hiddenLetters(activeWord, revealedSoFar, isLastInner) * PPL;

      setScore((prev) => Math.max(0, prev + gained));

      if (currentIdx >= chain.length - 2) {
        setPhase("won");
      } else {
        setCurrentIdx((i) => i + 1);
        setCurrentRevealed(0);
        setGuess("");
        setFeedback("idle");
        focusInput();
      }
    } else {
      // ── Wrong guess ────────────────────────────────────────────────────────
      setScore((prev) => Math.max(0, prev - WRONG_PEN));
      setWrongTotal((n) => n + 1);
      // Reveal one more letter, capped at the full word length
      setCurrentRevealed((prev) => Math.min(prev + 1, activeWord.length - 1));
      setGuess("");
      setFeedback("wrong");
      focusInput();
    }
  }, [phase, chain, currentIdx, currentRevealed, guess, focusInput]);

  // Refocus input whenever the active word changes
  useEffect(() => {
    if (phase === "playing") focusInput();
  }, [phase, currentIdx, focusInput]);

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
            Guess the hidden words to build the chain from{" "}
            <span className="cr__start-text">START</span> to{" "}
            <span className="cr__end-text">END</span>. Each word starts where
            the last one ended. Guess early for big points — every wrong guess
            reveals one more letter and costs you points.
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
          <button className="cr__primary-btn" onClick={() => startGame()}>
            ▶ NEW GAME
          </button>
        </div>
      </div>
    );
  }

  // ── Won screen ────────────────────────────────────────────────────────────────

  if (phase === "won") {
    return (
      <div className="cr">
        <div className="cr__won-banner">CHAIN SOLVED!</div>
        <div className="cr__won-stats">
          <span>Score: {score}</span>
          <span>Wrong guesses: {wrongTotal}</span>
        </div>
        <div className="cr__chain">
          {chain.map((word, i) => {
            const isStart = i === 0;
            const isEnd = i === chain.length - 1;
            return (
              <div key={i} className="cr__word-group">
                <div className="cr__word-row">
                  <span className={`cr__word-tag${isStart ? " cr__word-tag--start" : isEnd ? " cr__word-tag--end" : ""}`}>
                    {isStart ? "START" : isEnd ? "END" : ""}
                  </span>
                  <div className="cr__letters">
                    {word.split("").map((letter, li) => (
                      <span
                        key={li}
                        className={`cr__cell ${isStart ? "cr__cell--start" : isEnd ? "cr__cell--end" : "cr__cell--solved"}`}
                      >
                        {letter.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                {i < chain.length - 1 && <div className="cr__arrow">↓</div>}
              </div>
            );
          })}
        </div>
        <button className="cr__primary-btn" onClick={() => startGame()}>
          ▶ NEW GAME
        </button>
      </div>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────────────

  const activeWord = chain[currentIdx];
  const firstLetter = activeWord[0];
  const revealedSoFar = Math.min(currentRevealed + 1, activeWord.length);
  const isLastInner = currentIdx === chain.length - 2;
  const trailingLetter = chain[chain.length - 1][0]; // END word's first letter
  // Is the whole active word now visible through wrong-guess reveals?
  const allRevealedByMistakes = isLastInner
    ? revealedSoFar + 1 >= activeWord.length
    : revealedSoFar >= activeWord.length;

  return (
    <div className="cr">
      {/* Status */}
      <div className="cr__status">
        <div className="cr__status-item">Score: <strong>{score}</strong></div>
        <div className="cr__status-item">Wrong: <strong>{wrongTotal}</strong></div>
        <div className="cr__status-item cr__status-progress">
          Word {currentIdx} of {chain.length - 2}
        </div>
      </div>

      {/* Chain */}
      <div className="cr__chain">
        {chain.map((word, i) => {
          const isStart = i === 0;
          const isEnd = i === chain.length - 1;
          const isSolved = i > 0 && i < currentIdx; // inner, already guessed
          const isActive = i === currentIdx;
          const isFuture = i > currentIdx && !isEnd;
          const isThisLastInner = i === chain.length - 2;

          return (
            <div key={i} className="cr__word-group">
              <div className={`cr__word-row${isActive ? " cr__word-row--active" : ""}`}>
                {/* Label column */}
                <span
                  className={`cr__word-tag${isStart ? " cr__word-tag--start" : isEnd ? " cr__word-tag--end" : ""}`}
                >
                  {isStart ? "START" : isEnd ? "END" : ""}
                </span>

                {/* Letters / placeholder */}
                <div className="cr__letters">
                  {isStart || isEnd ? (
                    // Full word shown
                    word.split("").map((letter, li) => (
                      <span key={li} className={`cr__cell ${isStart ? "cr__cell--start" : "cr__cell--end"}`}>
                        {letter.toUpperCase()}
                      </span>
                    ))
                  ) : isSolved ? (
                    // Solved inner word — show in full green
                    word.split("").map((letter, li) => (
                      <span key={li} className="cr__cell cr__cell--solved">
                        {letter.toUpperCase()}
                      </span>
                    ))
                  ) : isActive ? (
                    // Active word being guessed
                    allRevealedByMistakes ? (
                      // All letters now revealed via wrong guesses
                      word.split("").map((letter, li) => (
                        <span
                          key={li}
                          className={`cr__cell ${li === 0 ? "cr__cell--connector" : "cr__cell--leaked"}`}
                        >
                          {letter.toUpperCase()}
                        </span>
                      ))
                    ) : (
                      <>
                        {/* Known prefix */}
                        {word.substring(0, revealedSoFar).split("").map((letter, li) => (
                          <span
                            key={li}
                            className={`cr__cell ${li === 0 ? "cr__cell--connector" : "cr__cell--leaked"}`}
                          >
                            {letter.toUpperCase()}
                          </span>
                        ))}
                        {/* Unknown gap */}
                        <span className="cr__cell cr__cell--gap">…</span>
                        {/* Trailing letter from END (last inner word only) */}
                        {isLastInner && (
                          <span className="cr__cell cr__cell--trailing">
                            {trailingLetter.toUpperCase()}
                          </span>
                        )}
                      </>
                    )
                  ) : isFuture ? (
                    // Future word not yet reached
                    isThisLastInner ? (
                      // Show trailing hint from END
                      <>
                        <span className="cr__cell cr__cell--gap">…</span>
                        <span className="cr__cell cr__cell--trailing">
                          {trailingLetter.toUpperCase()}
                        </span>
                      </>
                    ) : (
                      <span className="cr__cell cr__cell--unknown">?</span>
                    )
                  ) : null}
                </div>
              </div>

              {i < chain.length - 1 && <div className="cr__arrow">↓</div>}
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="cr__input-area">
        <div className="cr__input-hint">
          Starts with:{" "}
          <span className="cr__input-letter">{firstLetter.toUpperCase()}</span>
        </div>
        <div className="cr__input-row">
          <input
            ref={inputRef}
            type="text"
            className="cr__input"
            value={guess}
            onChange={(e) => {
              setGuess(e.target.value);
              if (feedback !== "idle") setFeedback("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitGuess();
            }}
            maxLength={24}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={`${firstLetter}...`}
          />
          <button className="cr__guess-btn" onClick={submitGuess}>
            GUESS
          </button>
        </div>
        {feedback === "wrong" && (
          <div className="cr__feedback cr__feedback--wrong">✗ WRONG — one more letter revealed</div>
        )}
        {feedback === "badstart" && (
          <div className="cr__feedback cr__feedback--bad">
            Word must start with {firstLetter.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
