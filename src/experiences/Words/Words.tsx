import { useState, useEffect, useCallback, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { getWordsOfLength, isValidWord } from "../../utils/dictionary";
import "./Words.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type TileState = "empty" | "filled" | "correct" | "present" | "absent";
type GamePhase = "playing" | "won" | "lost";

interface SubmittedGuess {
  word: string;
  states: TileState[];
}

interface WordsProps {
  onQuit?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_GUESSES = 6;
const DEFAULT_LENGTH = 5;

// Alphabetical layout — 7 per row so keys fill the container width
const ALPHA_ROWS: string[][] = [
  ["A", "B", "C", "D", "E", "F", "G"],
  ["H", "I", "J", "K", "L", "M", "N"],
  ["O", "P", "Q", "R", "S", "T", "U"],
  ["V", "W", "X", "Y", "Z"],
];

const WIN_MESSAGES = [
  "Genius!",
  "Magnificent!",
  "Impressive!",
  "Splendid!",
  "Great!",
  "Phew!",
];

const STATE_PRIORITY: Record<TileState, number> = {
  correct: 3,
  present: 2,
  absent: 1,
  filled: 0,
  empty: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeTileStates(guess: string, target: string): TileState[] {
  const states: TileState[] = Array(guess.length).fill("absent");
  const remaining = target.split("");

  // First pass: exact position matches
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === remaining[i]) {
      states[i] = "correct";
      remaining[i] = "";
    }
  }

  // Second pass: letters present but wrong position
  for (let i = 0; i < guess.length; i++) {
    if (states[i] === "correct") continue;
    const idx = remaining.indexOf(guess[i]);
    if (idx !== -1) {
      states[i] = "present";
      remaining[idx] = "";
    }
  }

  return states;
}

function pickTarget(length: number): string {
  const words = getWordsOfLength(length);
  return words[Math.floor(Math.random() * words.length)];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Words({ onQuit }: WordsProps) {
  const [wordLength, setWordLength] = useState(DEFAULT_LENGTH);
  const [target, setTarget] = useState(() => pickTarget(DEFAULT_LENGTH));
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [shakeRow, setShakeRow] = useState(false);
  const [message, setMessage] = useState("");
  const [helpDialog, setHelpDialog] = useState<"instructions" | "about" | null>(null);

  // Best state seen for each letter (drives keyboard coloring)
  const letterStates = useMemo<Record<string, TileState>>(() => {
    const map: Record<string, TileState> = {};
    for (const g of guesses) {
      for (let i = 0; i < g.word.length; i++) {
        const ch = g.word[i];
        const st = g.states[i];
        if (!map[ch] || STATE_PRIORITY[st] > STATE_PRIORITY[map[ch]]) {
          map[ch] = st;
        }
      }
    }
    return map;
  }, [guesses]);

  const startNewGame = useCallback(
    (len?: number) => {
      const length = len ?? wordLength;
      setWordLength(length);
      setTarget(pickTarget(length));
      setGuesses([]);
      setCurrentInput("");
      setPhase("playing");
      setMessage("");
    },
    [wordLength]
  );

  const showError = useCallback((msg: string) => {
    setShakeRow(true);
    setMessage(msg);
    setTimeout(() => {
      setShakeRow(false);
      setMessage("");
    }, 700);
  }, []);

  const submitGuess = useCallback(() => {
    if (phase !== "playing") return;

    if (currentInput.length !== wordLength) {
      showError("Not enough letters");
      return;
    }

    const lower = currentInput.toLowerCase();
    if (!isValidWord(lower)) {
      showError("Not in word list");
      return;
    }

    const states = computeTileStates(lower, target);
    const newGuesses = [...guesses, { word: lower, states }];
    setGuesses(newGuesses);
    setCurrentInput("");

    if (lower === target) {
      setPhase("won");
      setMessage(WIN_MESSAGES[Math.min(newGuesses.length - 1, WIN_MESSAGES.length - 1)]);
    } else if (newGuesses.length >= MAX_GUESSES) {
      setPhase("lost");
      setMessage(target.toUpperCase());
    }
  }, [phase, currentInput, wordLength, guesses, target, showError]);

  const handleKey = useCallback(
    (key: string) => {
      if (phase !== "playing") return;
      if (key === "ENTER") {
        submitGuess();
      } else if (key === "⌫" || key === "BACKSPACE") {
        setCurrentInput((prev) => prev.slice(0, -1));
      } else if (/^[A-Z]$/.test(key) && currentInput.length < wordLength) {
        setCurrentInput((prev) => prev + key);
      }
    },
    [phase, currentInput, wordLength, submitGuess]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("BACKSPACE");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  const menus = useMemo<MenuBarMenu[]>(
    () => [
      {
        label: "Game",
        items: [
          { label: "New Game", onClick: () => startNewGame() },
          { separator: true },
          ...[4, 5, 6, 7, 8].map((n) => ({
            label: `${n} Letters`,
            checked: wordLength === n,
            onClick: () => startNewGame(n),
          })),
          ...(onQuit
            ? ([{ separator: true }, { label: "Quit", onClick: onQuit }] as MenuBarMenu["items"])
            : []),
        ],
      },
      {
        label: "Help",
        items: [
          { label: "Instructions", onClick: () => setHelpDialog("instructions") },
          { label: "About WORDS",  onClick: () => setHelpDialog("about") },
        ],
      },
    ],
    [wordLength, startNewGame, onQuit]
  );

  useWindowMenus(menus);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="words">
      {/* Message bar (error / win / lose) */}
      <div className="words-message-area">
        {message && (
          <span
            className={`words-message${phase === "lost" ? " words-message--lost" : phase === "won" ? " words-message--won" : " words-message--error"}`}
          >
            {message}
          </span>
        )}
      </div>

      {/* Guess grid */}
      <div className={`words-grid words-grid--len-${wordLength}`}>
        {Array.from({ length: MAX_GUESSES }, (_, r) => {
          const isCurrentRow = r === guesses.length && phase === "playing";
          const submitted = guesses[r];
          return (
            <div
              key={r}
              className={`words-row${isCurrentRow && shakeRow ? " words-row--shake" : ""}`}
            >
              {Array.from({ length: wordLength }, (_, c) => {
                let letter = "";
                let state: TileState = "empty";
                if (submitted) {
                  letter = submitted.word[c].toUpperCase();
                  state = submitted.states[c];
                } else if (isCurrentRow) {
                  letter = currentInput[c] ?? "";
                  state = letter ? "filled" : "empty";
                }
                return (
                  <div key={c} className={`words-tile words-tile--${state}`}>
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* On-screen keyboard — alphabetical, fills full width */}
      <div className="words-keyboard">
        {ALPHA_ROWS.map((row, ri) => {
          const padBefore = Math.floor((7 - row.length) / 2);
          const padAfter = 7 - row.length - padBefore;
          return (
            <div key={ri} className="words-keyboard__row">
              {Array.from({ length: padBefore }, (_, i) => (
                <div key={`pb${i}`} className="words-key-spacer" />
              ))}
              {row.map((key) => {
                const keyState = letterStates[key.toLowerCase()];
                return (
                  <button
                    key={key}
                    className={`words-key${keyState ? ` words-key--${keyState}` : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleKey(key)}
                  >
                    {key}
                  </button>
                );
              })}
              {Array.from({ length: padAfter }, (_, i) => (
                <div key={`pa${i}`} className="words-key-spacer" />
              ))}
            </div>
          );
        })}
      </div>

      {/* Action bar — Enter/Delete while playing, New Game when over */}
      <div className="words-actions">
        {phase === "playing" ? (
          <>
            <button
              className="words-action-btn words-action-btn--back"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleKey("BACKSPACE")}
            >
              ⌫ Delete
            </button>
            <button
              className="words-action-btn words-action-btn--enter"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleKey("ENTER")}
            >
              Enter ↵
            </button>
          </>
        ) : (
          <button
            className="words-action-btn words-action-btn--new"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => startNewGame()}
          >
            New Game ↺
          </button>
        )}
      </div>

      {/* Help dialogs */}
      {helpDialog && (
        <div className="words-dialog-overlay" onClick={() => setHelpDialog(null)}>
          <div className="words-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="words-dialog__title">
              {helpDialog === "instructions" ? "How to Play WORDS" : "About WORDS"}
            </div>

            <div className="words-dialog__body">
              {helpDialog === "instructions" ? (
                <>
                  <p>Guess the hidden word in <strong>6 tries</strong>. Each guess must be a real word — press Enter to submit.</p>
                  <p>After each guess the tiles show how close you were:</p>
                  <div className="words-dialog__examples">
                    <div className="words-dialog__example">
                      <div className="words-tile words-tile--correct words-tile--sm">A</div>
                      <span>Right letter, right spot</span>
                    </div>
                    <div className="words-dialog__example">
                      <div className="words-tile words-tile--present words-tile--sm">B</div>
                      <span>Right letter, wrong spot</span>
                    </div>
                    <div className="words-dialog__example">
                      <div className="words-tile words-tile--absent words-tile--sm">C</div>
                      <span>Not in the word at all</span>
                    </div>
                  </div>
                  <p>The keyboard is shaded the same way so you can track which letters are still in play.</p>
                  <p>Change word length (4–8 letters) any time via the <strong>Game</strong> menu. Longer words are harder!</p>
                </>
              ) : (
                <>
                  <p><strong>WORDS</strong> — a word-guessing game for NS Doors 97.</p>
                  <p>Inspired by Lingo and Wordle. Built by Noahsoft™.</p>
                  <p>Uses the ENABLE public-domain word list (filtered for family friendliness).</p>
                  <p>Version 1.0  •  © 1996 Noahsoft Corp.</p>
                </>
              )}
            </div>

            <div className="words-dialog__footer">
              <button className="words-dialog__ok" onClick={() => setHelpDialog(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
