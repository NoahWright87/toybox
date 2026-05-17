import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import rawWords from "../../data/words/wordlist-clean.txt?raw";
import "./ChainReaction.css";

// ── Word index (built once, cached) ──────────────────────────────────────────

let _chainWords: string[] | null = null;
let _byFirstLetter: Map<string, string[]> | null = null;

function getChainWords(): string[] {
  if (!_chainWords) {
    _chainWords = rawWords
      .split("\n")
      .map((w) => w.trim())
      .filter((w) => w.length >= 4 && /^[a-z]+$/.test(w));
  }
  return _chainWords!;
}

function getByFirstLetter(): Map<string, string[]> {
  if (!_byFirstLetter) {
    _byFirstLetter = new Map<string, string[]>();
    for (const word of getChainWords()) {
      const fl = word[0];
      if (!_byFirstLetter.has(fl)) _byFirstLetter.set(fl, []);
      _byFirstLetter.get(fl)!.push(word);
    }
  }
  return _byFirstLetter!;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildChain(targetLength: number): string[] | null {
  const words = getChainWords();
  const index = getByFirstLetter();

  for (let attempt = 0; attempt < 300; attempt++) {
    const start = words[Math.floor(Math.random() * words.length)];
    const chain: string[] = [start];
    const used = new Set<string>([start]);

    if (dfs(chain, used, targetLength, index)) {
      return chain;
    }
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

  // Try up to 30 random candidates
  const shuffled = shuffle(candidates).slice(0, 30);
  for (const w of shuffled) {
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
  revealed: boolean[];
  isStart: boolean;
  isEnd: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_MISTAKES = 6;
const POINTS_PER_LETTER = 50;
const SOLVE_BONUS = 300;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

// ── Chain initializer ─────────────────────────────────────────────────────────

function makeChain(words: string[]): ChainWord[] {
  return words.map((word, i) => {
    const isStart = i === 0;
    const isEnd = i === words.length - 1;
    const revealed = word.split("").map((_, idx) => {
      if (isStart || isEnd) return true;
      return idx === 0 || idx === word.length - 1;
    });
    return { word, revealed, isStart, isEnd };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ChainReactionProps {
  onQuit: () => void;
}

export default function ChainReaction({ onQuit }: ChainReactionProps) {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [chainLength, setChainLength] = useState<ChainLength>(6);
  const [chain, setChain] = useState<ChainWord[]>([]);
  const [correctGuesses, setCorrectGuesses] = useState<Set<string>>(new Set<string>());
  const [wrongGuesses, setWrongGuesses] = useState<Set<string>>(new Set<string>());
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const chainLengthRef = useRef<ChainLength>(chainLength);
  chainLengthRef.current = chainLength;

  const startGame = useCallback((length?: ChainLength) => {
    const len = length ?? chainLengthRef.current;
    const words = buildChain(len);
    if (!words) return; // very unlikely with 80k word dictionary
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
      const newChain = chain.map((cw) => {
        if (cw.isStart || cw.isEnd) return cw;
        const newRevealed = cw.revealed.map((r, i) => {
          if (r) return true;
          if (cw.word[i] === letter) {
            tilesRevealed++;
            return true;
          }
          return false;
        });
        return { ...cw, revealed: newRevealed };
      });

      if (tilesRevealed > 0) {
        setCorrectGuesses((prev) => new Set<string>([...prev, letter]));
        setChain(newChain);
        const gained = tilesRevealed * POINTS_PER_LETTER;
        const allDone = newChain.every((cw) => cw.revealed.every((r) => r));
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
          // Reveal the full chain so player can see the answer
          setChain(chain.map((cw) => ({ ...cw, revealed: cw.revealed.map(() => true) })));
          setPhase("lost");
        }
      }
    },
    [phase, correctGuesses, wrongGuesses, chain, mistakes]
  );

  // Keyboard support
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
            onClick: () => {
              setChainLength(4);
              startGame(4);
            },
          },
          {
            label: "Medium Chain (6 words)",
            checked: chainLength === 6,
            onClick: () => {
              setChainLength(6);
              startGame(6);
            },
          },
          {
            label: "Long Chain (8 words)",
            checked: chainLength === 8,
            onClick: () => {
              setChainLength(8);
              startGame(8);
            },
          },
          { separator: true },
          { label: "Quit", onClick: onQuit },
        ],
      },
    ],
    [chainLength, startGame, onQuit]
  );
  useWindowMenus(menus);

  // ── Setup screen ────────────────────────────────────────────────────────────

  if (phase === "setup") {
    return (
      <div className="cr">
        <div className="cr__setup">
          <div className="cr__setup-title">CHAIN REACTION</div>
          <p className="cr__setup-desc">
            Guess letters to reveal the hidden words. Each word's last letter is
            the first letter of the next — forming a chain from{" "}
            <span className="cr__setup-start">START</span> to{" "}
            <span className="cr__setup-end">END</span>.
          </p>
          <div className="cr__setup-row">
            <span className="cr__setup-label">Chain length:</span>
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
          <button className="cr__start-btn" onClick={() => startGame()}>
            ▶ NEW GAME
          </button>
        </div>
      </div>
    );
  }

  // ── Playing / end screen ───────────────────────────────────────────────────

  const allGuessed = new Set<string>([...correctGuesses, ...wrongGuesses]);

  return (
    <div className="cr">
      {/* Status bar */}
      <div className="cr__status">
        <div className="cr__lives">
          {Array.from({ length: MAX_MISTAKES }, (_, i) => (
            <span
              key={i}
              className={`cr__life${i < mistakes ? " cr__life--lost" : ""}`}
            >
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
                  const isConnector =
                    !cw.isStart &&
                    !cw.isEnd &&
                    (li === 0 || li === cw.word.length - 1);
                  const revealed = cw.revealed[li];
                  return (
                    <span
                      key={li}
                      className={[
                        "cr__cell",
                        cw.isStart
                          ? "cr__cell--start"
                          : cw.isEnd
                          ? "cr__cell--end"
                          : "cr__cell--inner",
                        isConnector ? "cr__cell--connector" : "",
                        revealed && !cw.isStart && !cw.isEnd && !isConnector
                          ? "cr__cell--revealed"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {revealed ? letter.toUpperCase() : ""}
                    </span>
                  );
                })}
              </div>
            </div>
            {wi < chain.length - 1 && (
              <div className="cr__arrow">↓</div>
            )}
          </div>
        ))}
      </div>

      {/* Result banner */}
      {(phase === "won" || phase === "lost") && (
        <div className={`cr__result${phase === "won" ? " cr__result--won" : " cr__result--lost"}`}>
          <span className="cr__result-text">
            {phase === "won" ? "CHAIN SOLVED!" : "CHAIN BROKEN!"}
          </span>
          <span className="cr__result-score">Final score: {score}</span>
          <button className="cr__start-btn" onClick={() => startGame()}>
            ▶ NEW GAME
          </button>
        </div>
      )}

      {/* Keyboard */}
      {phase === "playing" && (
        <div className="cr__keyboard">
          {ALPHABET.map((letter) => {
            const correct = correctGuesses.has(letter);
            const wrong = wrongGuesses.has(letter);
            return (
              <button
                key={letter}
                className={[
                  "cr__key",
                  correct ? "cr__key--correct" : "",
                  wrong ? "cr__key--wrong" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleGuess(letter)}
                disabled={allGuessed.has(letter)}
              >
                {letter.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
