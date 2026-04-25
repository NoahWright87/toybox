import { useState, useEffect, useRef, useCallback } from "react";
import { getAnagramsOf, getRandomWord, getWordDifficulty } from "../../utils/dictionary";
import "./WordWhirlwind.css";

// ── Types ──────────────────────────────────────────────────────────────────────

type GamePhase = "setup" | "playing" | "gameOver";
type GameMode = "freeplay" | "standard" | "strict";
type TimeLimit = 60 | 120 | 180 | 300 | null;
type WordLength = 5 | 6 | 7 | 8;
type DifficultyLevel = "easy" | "normal" | "hard" | "all";

interface Settings {
  wordLength: WordLength;
  timeLimit: TimeLimit;
  mode: GameMode;
  showHints: boolean;
  difficulty: DifficultyLevel;
}

interface Tile {
  id: number;
  letter: string;
}

interface Flash {
  text: string;
  kind: "good" | "bad";
  key: number;
}

interface RoundSummary {
  wordsFound: number;
  totalWords: number;
  speedBonus: number;
  clearBonus: number;
  isGameOver: boolean;
  answer: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const WORD_SCORE: Record<number, number> = {
  3: 100,
  4: 200,
  5: 350,
  6: 500,
  7: 700,
  8: 1000,
};
const FULL_CLEAR_BONUS = 500;
const SPEED_BONUS_PER_SEC = 3;
const DIFFICULTY_MAX_SCORE: Record<DifficultyLevel, number | undefined> = {
  easy: 45,
  normal: 70,
  hard: 85,
  all: undefined,
};
const DEFAULT_SETTINGS: Settings = {
  wordLength: 6,
  timeLimit: 120,
  mode: "standard",
  showHints: true,
  difficulty: "normal",
};

// ── Pure helpers ───────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function generatePuzzle(
  settings: Settings
): { word: string; solutions: string[] } | null {
  const minWords = Math.max(settings.wordLength * 2, 8);
  const maxDifficulty = DIFFICULTY_MAX_SCORE[settings.difficulty];

  for (let pass = 0; pass < 2; pass++) {
    const limit = pass === 0 ? 60 : 30;
    for (let i = 0; i < limit; i++) {
      const word = getRandomWord(settings.wordLength, maxDifficulty);
      if (!word) return null;
      const solutions = getAnagramsOf(word, 3).filter((w) => {
        const diff = getWordDifficulty(w);
        return maxDifficulty === undefined || diff <= maxDifficulty;
      });
      if (solutions.length >= (pass === 0 ? minWords : 1)) {
        return { word, solutions: [...solutions].sort() };
      }
    }
  }
  return null;
}

// ── Hint helpers ───────────────────────────────────────────────────────────────

function commonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

/**
 * For each unfound word, find the nearest found word on each side in the
 * sorted list and return the common prefix of those two bounds.
 *
 * Special cases:
 * - If an unfound word comes BEFORE the earliest found word alphabetically,
 *   its first letter must match the earliest found word's first letter.
 * - If an unfound word comes AFTER the latest found word alphabetically,
 *   its first letter must match the latest found word's first letter.
 */
function computeGroupHints(
  words: string[],
  foundWords: Set<string>
): Map<string, string> {
  const hints = new Map<string, string>();

  // Find earliest and latest found words
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

    // Standard case: word is between two found words
    if (left !== null && right !== null) {
      hints.set(words[i], commonPrefix(left, right));
    }
    // Special case: word comes BEFORE the earliest found word
    else if (earliestFound !== null && words[i] < earliestFound) {
      hints.set(words[i], earliestFound[0]);
    }
    // Special case: word comes AFTER the latest found word
    else if (latestFound !== null && words[i] > latestFound) {
      hints.set(words[i], latestFound[0]);
    }
  }
  return hints;
}

type DisplayItem =
  | { type: "found"; word: string }
  | { type: "unfound"; word: string; hint: string }
  | { type: "ellipsis"; count: number };

/**
 * Convert a sorted word list + found set into display items, collapsing
 * runs of 3+ consecutive found words to an ellipsis.
 */
function buildGroupItems(
  words: string[],
  foundWords: Set<string>,
  hints: Map<string, string>
): DisplayItem[] {
  const raw: DisplayItem[] = words.map((w) =>
    foundWords.has(w)
      ? { type: "found" as const, word: w }
      : { type: "unfound" as const, word: w, hint: hints.get(w) ?? "" }
  );

  const result: DisplayItem[] = [];
  let i = 0;
  while (i < raw.length) {
    const item = raw[i];
    if (item.type === "found") {
      let j = i;
      while (j < raw.length && raw[j].type === "found") j++;
      const runLen = j - i;
      if (runLen >= 3) {
        result.push(raw[i]);
        result.push({ type: "ellipsis", count: runLen - 2 });
        result.push(raw[j - 1]);
      } else {
        for (let k = i; k < j; k++) result.push(raw[k]);
      }
      i = j;
    } else {
      result.push(item);
      i++;
    }
  }
  return result;
}

// ── SetupScreen ────────────────────────────────────────────────────────────────

const MODE_HINTS: Record<GameMode, string> = {
  freeplay: "Always advance — just find as many words as you can",
  standard: "Find at least one full-length word to move on",
  strict: "Find every valid word — good luck, you'll need it",
};

function SetupScreen({
  onStart,
  onHome,
}: {
  onStart: (s: Settings) => void;
  onHome?: () => void;
}) {
  const [wordLength, setWordLength] = useState<WordLength>(6);
  const [timeLimit, setTimeLimit] = useState<TimeLimit>(120);
  const [mode, setMode] = useState<GameMode>("standard");
  const [showHints, setShowHints] = useState(true);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("normal");

  const timeLimitLabels: [TimeLimit, string][] = [
    [60, "1 min"],
    [120, "2 min"],
    [180, "3 min"],
    [300, "5 min"],
    [null, "Unlimited"],
  ];

  return (
    <div className="ww-setup">
      <h1 className="ww-setup__title">Word Whirlwind</h1>
      <p className="ww-setup__subtitle">Unscramble letters · find every word</p>

      <div className="ww-setup__section">
        <div className="ww-setup__label">Word Length</div>
        <div className="ww-setup__options">
          {([5, 6, 7, 8] as WordLength[]).map((n) => (
            <button
              key={n}
              className={`ww-setup__option${wordLength === n ? " ww-setup__option--active" : ""}`}
              onClick={() => setWordLength(n)}
            >
              {n} letters
            </button>
          ))}
        </div>
      </div>

      <div className="ww-setup__section">
        <div className="ww-setup__label">Time Limit</div>
        <div className="ww-setup__options">
          {timeLimitLabels.map(([t, label]) => (
            <button
              key={label}
              className={`ww-setup__option${timeLimit === t ? " ww-setup__option--active" : ""}`}
              onClick={() => setTimeLimit(t)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ww-setup__section">
        <div className="ww-setup__label">Game Mode</div>
        <div className="ww-setup__options">
          {(["freeplay", "standard", "strict"] as GameMode[]).map((m) => (
            <button
              key={m}
              className={`ww-setup__option${mode === m ? " ww-setup__option--active" : ""}`}
              onClick={() => setMode(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="ww-setup__hint">{MODE_HINTS[mode]}</div>
      </div>

      <div className="ww-setup__section">
        <div className="ww-setup__label">Hints</div>
        <div className="ww-setup__options">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              className={`ww-setup__option${showHints === v ? " ww-setup__option--active" : ""}`}
              onClick={() => setShowHints(v)}
            >
              {v ? "On" : "Off"}
            </button>
          ))}
        </div>
        <div className="ww-setup__hint">Reveal letters from found-word neighbors</div>
      </div>

      <div className="ww-setup__section">
        <div className="ww-setup__label">Word Difficulty</div>
        <div className="ww-setup__options">
          {(["easy", "normal", "hard", "all"] as DifficultyLevel[]).map((d) => (
            <button
              key={d}
              className={`ww-setup__option${difficulty === d ? " ww-setup__option--active" : ""}`}
              onClick={() => setDifficulty(d)}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <div className="ww-setup__hint">Easy = common words, Hard = obscure words</div>
      </div>

      <button
        className="ww-setup__start"
        onClick={() => onStart({ wordLength, timeLimit, mode, showHints, difficulty })}
      >
        Play!
      </button>

      {onHome && (
        <button className="ww-setup__home" onClick={onHome}>
          ← Toy Box
        </button>
      )}
    </div>
  );
}

// ── MissedWordsSection ─────────────────────────────────────────────────────────

function MissedWordsSection({
  allWords,
  foundWords,
}: {
  allWords: string[];
  foundWords: Set<string>;
}) {
  const missed = allWords.filter((w) => !foundWords.has(w));
  if (missed.length === 0) return null;

  const groups = new Map<number, string[]>();
  for (const w of missed) {
    if (!groups.has(w.length)) groups.set(w.length, []);
    groups.get(w.length)!.push(w);
  }
  const lengths = [...groups.keys()].sort((a, b) => b - a);

  return (
    <div className="ww-missed">
      <div className="ww-missed__title">Words you missed</div>
      {lengths.map((len) => (
        <div key={len} className="ww-missed__group">
          <span className="ww-missed__group-label">{len}-ltr:</span>
          {groups.get(len)!.map((w) => (
            <span key={w} className="ww-missed__word">
              {w.toUpperCase()}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── WordGroupsPanel ────────────────────────────────────────────────────────────

function WordGroupsPanel({
  allWords,
  foundWords,
  showHints,
  revealAll,
  revealedLetters,
}: {
  allWords: string[];
  foundWords: Set<string>;
  showHints: boolean;
  revealAll?: boolean;
  revealedLetters?: Map<string, number>;
}) {
  const groups = new Map<number, string[]>();
  for (const w of allWords) {
    if (!groups.has(w.length)) groups.set(w.length, []);
    groups.get(w.length)!.push(w);
  }
  const lengths = [...groups.keys()].sort((a, b) => b - a);

  const [userExpanded, setUserExpanded] = useState<Set<number>>(new Set());
  const [userCollapsed, setUserCollapsed] = useState<Set<number>>(new Set());

  const isGroupComplete = useCallback(
    (len: number) => {
      const words = groups.get(len) ?? [];
      return words.length > 0 && words.every((w) => foundWords.has(w));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [foundWords, allWords]
  );

  function isExpanded(len: number): boolean {
    if (userExpanded.has(len)) return true;
    if (userCollapsed.has(len)) return false;
    return !isGroupComplete(len);
  }

  function toggleGroup(len: number) {
    const expanded = isExpanded(len);
    if (expanded) {
      setUserCollapsed((s) => new Set([...s, len]));
      setUserExpanded((s) => {
        const n = new Set(s);
        n.delete(len);
        return n;
      });
    } else {
      setUserExpanded((s) => new Set([...s, len]));
      setUserCollapsed((s) => {
        const n = new Set(s);
        n.delete(len);
        return n;
      });
    }
  }

  return (
    <div className="ww-word-groups">
      {lengths.map((len) => {
        const words = groups.get(len)!;
        const foundCount = words.filter((w) => foundWords.has(w)).length;
        const complete = foundCount === words.length;
        const expanded = isExpanded(len);
        const hints =
          showHints && expanded
            ? computeGroupHints(words, foundWords)
            : new Map<string, string>();
        const items = expanded
          ? buildGroupItems(words, foundWords, hints)
          : [];

        return (
          <div
            key={len}
            className={`ww-group${complete ? " ww-group--complete" : ""}`}
          >
            <button
              className="ww-group__header"
              onClick={() => toggleGroup(len)}
            >
              <span className="ww-group__title">
                {complete ? "✅ " : ""}
                {len}-letter
              </span>
              <span className="ww-group__count">
                {foundCount}/{words.length}
              </span>
              <span className="ww-group__chevron">
                {expanded ? "▾" : "▸"}
              </span>
            </button>

            {expanded && (
              <div className="ww-group__words">
                {items.map((item, idx) => {
                  if (item.type === "ellipsis") {
                    return (
                      <div key={`ellipsis-${idx}`} className="ww-word-ellipsis">
                        ··· {item.count} more ···
                      </div>
                    );
                  }
                  const isFound = item.type === "found";
                  const isMissed = revealAll && !isFound;
                  const hint = item.type === "unfound" ? item.hint : "";
                  const revealCount = revealedLetters?.get(item.word) ?? 0;
                  return (
                    <div
                      key={item.word}
                      className={`ww-word${isFound ? " ww-word--found" : ""}${isMissed ? " ww-word--missed" : ""}`}
                    >
                      {item.word.split("").map((ch, i) => {
                        const showLetter = isFound || isMissed;
                        const hinted = !showLetter && i < hint.length;
                        const revealed = !showLetter && i < revealCount;
                        return (
                          <span
                            key={i}
                            className={`ww-word__letter${hinted ? " ww-word__letter--hint" : ""}${revealed ? " ww-word__letter--revealed" : ""}`}
                          >
                            {showLetter || hinted || revealed ? ch.toUpperCase() : ""}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="ww-word-groups__spacer" />
    </div>
  );
}

// ── RoundSummaryOverlay ────────────────────────────────────────────────────────

function RoundSummaryOverlay({
  summary,
  round,
  totalScore,
  allWords,
  foundWords,
  onContinue,
}: {
  summary: RoundSummary;
  round: number;
  totalScore: number;
  allWords: string[];
  foundWords: Set<string>;
  onContinue: () => void;
}) {
  return (
    <div className="ww-overlay">
      <div className="ww-overlay__box">
        <div
          className={`ww-overlay__title${summary.isGameOver ? " ww-overlay__title--gameover" : ""}`}
        >
          {summary.isGameOver ? "Game Over" : `Round ${round} Clear!`}
        </div>

        {summary.isGameOver && (
          <div className="ww-overlay__answer">
            The word was{" "}
            <strong>{summary.answer.toUpperCase()}</strong>
          </div>
        )}

        <div className="ww-overlay__stats">
          <div className="ww-overlay__row">
            <span>Words found</span>
            <span>
              {summary.wordsFound} / {summary.totalWords}
            </span>
          </div>
          {summary.speedBonus > 0 && (
            <div className="ww-overlay__row ww-overlay__row--bonus">
              <span>Speed bonus</span>
              <span>+{summary.speedBonus}</span>
            </div>
          )}
          {summary.clearBonus > 0 && (
            <div className="ww-overlay__row ww-overlay__row--bonus">
              <span>Full clear!</span>
              <span>+{summary.clearBonus}</span>
            </div>
          )}
          <div className="ww-overlay__row ww-overlay__row--total">
            <span>Total score</span>
            <span>{totalScore.toLocaleString()}</span>
          </div>
        </div>

        <MissedWordsSection allWords={allWords} foundWords={foundWords} />

        <button className="ww-overlay__btn" onClick={onContinue}>
          {summary.isGameOver ? "See Final Score →" : "Next Round →"}
        </button>
      </div>
    </div>
  );
}

// ── GameOverScreen ─────────────────────────────────────────────────────────────

function GameOverScreen({
  score,
  rounds,
  allWords,
  foundWords,
  onPlayAgain,
  onSettings,
  onHome,
}: {
  score: number;
  rounds: number;
  allWords: string[];
  foundWords: Set<string>;
  onPlayAgain: () => void;
  onSettings: () => void;
  onHome?: () => void;
}) {
  return (
    <div className="ww-gameover">
      <div className="ww-gameover__label">Final Score</div>
      <div className="ww-gameover__score">{score.toLocaleString()}</div>
      <div className="ww-gameover__rounds">
        {rounds} round{rounds !== 1 ? "s" : ""} completed
      </div>
      <MissedWordsSection allWords={allWords} foundWords={foundWords} />
      <div className="ww-gameover__actions">
        <button className="ww-setup__start" onClick={onPlayAgain}>
          Play Again
        </button>
        <button
          className="ww-setup__option ww-setup__option--standalone"
          onClick={onSettings}
        >
          Change Settings
        </button>
        {onHome && (
          <button className="ww-setup__home" onClick={onHome}>
            ← Toy Box
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function WordWhirlwind({ onHome }: { onHome?: () => void } = {}) {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Puzzle state
  const [puzzleWord, setPuzzleWord] = useState("");
  const [allWords, setAllWords] = useState<string[]>([]);
  const [allWordsSet, setAllWordsSet] = useState<Set<string>>(new Set());
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [poolOrder, setPoolOrder] = useState<number[]>([]);
  const [boardTileIds, setBoardTileIds] = useState<number[]>([]);

  // Game state
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [canAdvance, setCanAdvance] = useState(false);
  const [lastFoundWord, setLastFoundWord] = useState("");
  const [lastActivityTime, setLastActivityTime] = useState(() => Date.now());
  const [advanceBtnVisible, setAdvanceBtnVisible] = useState(false);
  const [revealedLetters, setRevealedLetters] = useState<Map<string, number>>(new Map());

  // Refs for keyboard handler (avoids stale closures)
  const tilesRef = useRef<Tile[]>([]);
  const lastFoundWordRef = useRef("");
  const poolOrderRef = useRef<number[]>([]);
  const boardTileIdsRef = useRef<number[]>([]);
  const allWordsSetRef = useRef<Set<string>>(new Set());
  const foundWordsRef = useRef<Set<string>>(new Set());
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const puzzleWordRef = useRef("");
  const scoreRef = useRef(0);
  const timeRemainingRef = useRef<number | null>(null);
  const roundSummaryRef = useRef<RoundSummary | null>(null);
  const flashKeyRef = useRef(0);
  const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundRef = useRef(1);

  // Keep refs in sync
  lastFoundWordRef.current = lastFoundWord;
  tilesRef.current = tiles;
  poolOrderRef.current = poolOrder;
  boardTileIdsRef.current = boardTileIds;
  allWordsSetRef.current = allWordsSet;
  foundWordsRef.current = foundWords;
  settingsRef.current = settings;
  puzzleWordRef.current = puzzleWord;
  scoreRef.current = score;
  timeRemainingRef.current = timeRemaining;
  roundSummaryRef.current = roundSummary;
  roundRef.current = round;

  // ── Record activity (resets advance-button delay) ─────────────────────────

  const recordActivity = useCallback(() => {
    setLastActivityTime(Date.now());
  }, []);

  // ── Flash helper ──────────────────────────────────────────────────────────

  const showFlash = useCallback((text: string, kind: Flash["kind"]) => {
    flashKeyRef.current += 1;
    const key = flashKeyRef.current;
    setFlash({ text, kind, key });
    setTimeout(
      () => setFlash((f) => (f?.key === key ? null : f)),
      1400
    );
  }, []);

  // ── Round-end logic ───────────────────────────────────────────────────────

  const endRound = useCallback(
    (timerExpired: boolean, currentFoundWords: Set<string>) => {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }

      const s = settingsRef.current;
      const pw = puzzleWordRef.current;
      const aw = allWordsSetRef.current;
      const remaining = timeRemainingRef.current ?? 0;

      const foundAll = currentFoundWords.size === aw.size;
      const foundMaxLength = [...currentFoundWords].some(
        (w) => w.length === pw.length
      );

      // Determine if this is a game-over
      let isGameOver = false;
      if (timerExpired) {
        if (s.mode === "standard" && !foundMaxLength) isGameOver = true;
        if (s.mode === "strict" && !foundAll) isGameOver = true;
        // freeplay: never game over from timer
      }

      // Bonuses (only on successful advance)
      const speedBonus =
        !isGameOver && !timerExpired && s.timeLimit !== null
          ? Math.floor(remaining * SPEED_BONUS_PER_SEC)
          : 0;
      const clearBonus =
        !isGameOver && foundAll && s.mode === "standard"
          ? FULL_CLEAR_BONUS
          : 0;

      const bonusTotal = speedBonus + clearBonus;
      if (bonusTotal > 0) {
        setScore((sc) => sc + bonusTotal);
      }

      const summary: RoundSummary = {
        wordsFound: currentFoundWords.size,
        totalWords: aw.size,
        speedBonus,
        clearBonus,
        isGameOver,
        answer: pw,
      };
      setRoundSummary(summary);
      roundSummaryRef.current = summary;
    },
    []
  );

  // ── Start a round ─────────────────────────────────────────────────────────

  const startRound = useCallback(
    (s: Settings, roundNum: number, currentScore: number) => {
      const puzzle = generatePuzzle(s);
      if (!puzzle) {
        setPhase("gameOver");
        return;
      }

      const { word, solutions } = puzzle;
      const newTiles: Tile[] = word
        .split("")
        .map((letter, id) => ({ id, letter }));
      const ids = newTiles.map((t) => t.id);

      setPuzzleWord(word);
      setAllWords(solutions);
      setAllWordsSet(new Set(solutions));
      setFoundWords(new Set());
      setTiles(newTiles);
      setPoolOrder(shuffle(ids));
      setBoardTileIds([]);
      setLastFoundWord("");
      setScore(currentScore);
      setRound(roundNum);
      setRoundSummary(null);
      setCanAdvance(s.mode === "freeplay");
      setAdvanceBtnVisible(false);
      setLastActivityTime(Date.now());
      setFlash(null);
      setRevealedLetters(new Map());

      if (s.timeLimit !== null) {
        setTimeRemaining(s.timeLimit);
      } else {
        setTimeRemaining(null);
      }
      setPhase("playing");
    },
    []
  );

  // ── Timer ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing" || timeRemaining === null) return;
    if (timerIdRef.current) clearInterval(timerIdRef.current);

    timerIdRef.current = setInterval(() => {
      setTimeRemaining((t) => {
        if (t === null || t <= 0) return t;
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settings, round]);

  // Detect timer hitting 0
  useEffect(() => {
    if (
      phase !== "playing" ||
      timeRemaining !== 0 ||
      roundSummary !== null
    )
      return;
    endRound(true, foundWordsRef.current);
  }, [phase, timeRemaining, roundSummary, endRound]);

  // ── Advance-button 5-second delay ────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing" || !canAdvance) {
      setAdvanceBtnVisible(false);
      return;
    }
    setAdvanceBtnVisible(false);
    const id = setTimeout(() => setAdvanceBtnVisible(true), 5000);
    return () => clearTimeout(id);
  }, [lastActivityTime, canAdvance, phase]);

  // ── Submit word ───────────────────────────────────────────────────────────

  // Reload the letters of `word` from the tile pool onto the board.
  const replayWord = useCallback((word: string) => {
    const allTiles = tilesRef.current;
    const newBoardIds: number[] = [];
    const usedIds = new Set<number>();
    for (const letter of word) {
      const tile = allTiles.find(
        (t) => t.letter === letter && !usedIds.has(t.id)
      );
      if (tile) {
        newBoardIds.push(tile.id);
        usedIds.add(tile.id);
      }
    }
    setBoardTileIds(newBoardIds);
  }, []);

  const submitWord = useCallback(() => {
    recordActivity();
    const ids = boardTileIdsRef.current;

    // Empty board → replay last found word so player can try variations
    if (ids.length === 0) {
      if (lastFoundWordRef.current) {
        replayWord(lastFoundWordRef.current);
      }
      return;
    }

    if (ids.length < 3) {
      showFlash("Need at least 3 letters", "bad");
      return;
    }
    const word = ids.map((id) => tilesRef.current[id].letter).join("");

    if (foundWordsRef.current.has(word)) {
      showFlash("Already found!", "bad");
      return;
    }
    if (!allWordsSetRef.current.has(word)) {
      showFlash("Not a word", "bad");
      return;
    }

    const pts = WORD_SCORE[word.length] ?? word.length * 100;
    setScore((sc) => {
      scoreRef.current = sc + pts;
      return sc + pts;
    });
    setFoundWords((prev) => {
      const next = new Set(prev);
      next.add(word);

      const s = settingsRef.current;
      const pw = puzzleWordRef.current;
      const aw = allWordsSetRef.current;

      // Check advance conditions after adding word
      const foundMaxLength = [...next].some((w) => w.length === pw.length);
      const foundAll = next.size === aw.size;

      if (s.mode === "strict" && foundAll) {
        // Strict: auto-advance when all words found
        setTimeout(() => endRound(false, next), 0);
      } else if (s.mode === "standard" && foundMaxLength) {
        setCanAdvance(true);
      }

      return next;
    });

    showFlash(`+${pts}  ${word.toUpperCase()}`, "good");
    lastFoundWordRef.current = word;
    setLastFoundWord(word);
    setBoardTileIds([]);
  }, [showFlash, endRound, replayWord, recordActivity]);

  // ── Letter pool interactions ──────────────────────────────────────────────

  const addTileToBoard = useCallback((id: number) => {
    recordActivity();
    setBoardTileIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= tilesRef.current.length) return prev;
      return [...prev, id];
    });
  }, [recordActivity]);

  const removeTileFromBoard = useCallback((id: number) => {
    recordActivity();
    setBoardTileIds((prev) => prev.filter((x) => x !== id));
  }, [recordActivity]);

  const scramble = useCallback(() => {
    recordActivity();
    setPoolOrder((o) => shuffle(o));
  }, [recordActivity]);

  const clearBoard = useCallback(() => {
    recordActivity();
    setBoardTileIds([]);
  }, [recordActivity]);

  const addLetterFromPool = useCallback((letter: string) => {
    recordActivity();
    const boardIds = boardTileIdsRef.current;
    const allTiles = tilesRef.current;
    const tile = allTiles.find(
      (t) => t.letter === letter && !boardIds.includes(t.id)
    );
    if (tile) {
      setBoardTileIds((prev) => [...prev, tile.id]);
    }
  }, [recordActivity]);

  const removeLastFromBoard = useCallback(() => {
    recordActivity();
    setBoardTileIds((prev) => prev.slice(0, -1));
  }, [recordActivity]);

  const revealNextLetter = useCallback(() => {
    recordActivity();
    setRevealedLetters((prev) => {
      const next = new Map(prev);
      let revealed = false;

      for (const word of allWordsSetRef.current) {
        if (!foundWordsRef.current.has(word)) {
          const current = next.get(word) ?? 0;
          if (current < word.length) {
            next.set(word, current + 1);
            revealed = true;
            break;
          }
        }
      }

      if (revealed) {
        showFlash("Letter revealed", "good");
      }
      return next;
    });
  }, [recordActivity, showFlash]);

  // ── Keyboard handler ──────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") return;

    function onKey(e: KeyboardEvent) {
      if (roundSummaryRef.current !== null) return;
      // Don't intercept when typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Enter") {
        e.preventDefault();
        submitWord();
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        scramble();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        removeLastFromBoard();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearBoard();
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        revealNextLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        addLetterFromPool(e.key.toLowerCase());
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    phase,
    submitWord,
    scramble,
    removeLastFromBoard,
    clearBoard,
    addLetterFromPool,
    revealNextLetter,
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleStart(s: Settings) {
    setSettings(s);
    startRound(s, 1, 0);
  }

  function handleNextRound() {
    const s = settingsRef.current;
    const currentScore = scoreRef.current;
    const nextRound = roundRef.current + 1;
    startRound(s, nextRound, currentScore);
  }

  function handleAdvanceNow() {
    endRound(false, foundWordsRef.current);
  }

  function handleContinueAfterSummary() {
    const summary = roundSummaryRef.current;
    if (!summary) return;
    if (summary.isGameOver) {
      setPhase("gameOver");
    } else {
      handleNextRound();
    }
  }

  function handleQuit() {
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    setPhase("setup");
  }

  // ── Derived display values ────────────────────────────────────────────────

  const boardTiles = boardTileIds.map((id) => tiles[id]).filter(Boolean);
  const boardTileIdSet = new Set(boardTileIds);
  const poolTilesOrdered = poolOrder
    .filter((id) => !boardTileIdSet.has(id))
    .map((id) => tiles[id])
    .filter(Boolean);

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "setup") {
    return <SetupScreen onStart={handleStart} onHome={onHome} />;
  }

  if (phase === "gameOver") {
    return (
      <GameOverScreen
        score={score}
        rounds={round - 1}
        allWords={allWords}
        foundWords={foundWords}
        onPlayAgain={() => startRound(settings, 1, 0)}
        onSettings={() => setPhase("setup")}
        onHome={onHome}
      />
    );
  }

  const timerWarning =
    timeRemaining !== null && timeRemaining <= 15 && timeRemaining > 0;
  const timerDanger =
    timeRemaining !== null && timeRemaining <= 5 && timeRemaining > 0;

  const modeLabel =
    settings.mode === "freeplay"
      ? "Freeplay"
      : settings.mode === "standard"
      ? "Standard"
      : "Strict";

  return (
    <div className="ww-game">
      {/* ── Game bar ── */}
      <div className="ww-bar">
        <div className="ww-bar__left">
          <span className="ww-bar__round">Round {round}</span>
          <span className="ww-bar__mode">{modeLabel}</span>
        </div>
        <div
          className={`ww-bar__timer${timerWarning ? " ww-bar__timer--warn" : ""}${timerDanger ? " ww-bar__timer--danger" : ""}`}
        >
          {timeRemaining !== null ? formatTime(timeRemaining) : "∞"}
        </div>
        <div className="ww-bar__right">
          <span className="ww-bar__score">{score.toLocaleString()}</span>
          <button className="ww-bar__quit" onClick={handleQuit}>
            Quit
          </button>
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="ww-input">
        {/* Flash message */}
        <div className="ww-flash-wrap">
          {flash && (
            <div
              key={flash.key}
              className={`ww-flash ww-flash--${flash.kind}`}
            >
              {flash.text}
            </div>
          )}
        </div>

        {/* Board slots */}
        <div className="ww-board">
          {Array.from({ length: settings.wordLength }).map((_, i) => {
            const tile = boardTiles[i];
            return (
              <button
                key={tile ? `filled-${tile.id}` : `empty-${i}`}
                className={`ww-board__slot${tile ? " ww-board__slot--filled" : ""}`}
                onClick={() => tile && removeTileFromBoard(tile.id)}
                disabled={!tile}
              >
                {tile?.letter.toUpperCase() ?? ""}
              </button>
            );
          })}
        </div>

        {/* Controls row */}
        <div className="ww-controls">
          <div className="ww-controls__left">
            <button
              className="ww-btn ww-btn--secondary"
              onClick={scramble}
              title="Space"
            >
              Scramble
            </button>
            <button
              className="ww-btn ww-btn--secondary"
              onClick={clearBoard}
              title="Esc"
            >
              Clear
            </button>
          </div>
          <div className="ww-controls__right">
            {advanceBtnVisible && (
              <button
                className="ww-btn ww-btn--advance"
                onClick={handleAdvanceNow}
              >
                {settings.mode === "freeplay"
                  ? "Next Round →"
                  : "Submit Round →"}
              </button>
            )}
            <button
              className="ww-btn ww-btn--submit"
              onClick={submitWord}
              title="Enter"
            >
              Submit
            </button>
          </div>
        </div>

        {/* Pool */}
        <div className="ww-pool">
          {poolTilesOrdered.map((tile) => (
            <button
              key={tile.id}
              className="ww-pool__tile"
              onClick={() => addTileToBoard(tile.id)}
            >
              {tile.letter.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Word groups ── */}
      <WordGroupsPanel
        allWords={allWords}
        foundWords={foundWords}
        showHints={settings.showHints}
        revealAll={roundSummary !== null}
        revealedLetters={revealedLetters}
      />

      {/* ── Round summary overlay ── */}
      {roundSummary && (
        <RoundSummaryOverlay
          summary={roundSummary}
          round={round}
          totalScore={score}
          allWords={allWords}
          foundWords={foundWords}
          onContinue={handleContinueAfterSummary}
        />
      )}
    </div>
  );
}
