import { useState, useRef, useEffect, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { CHAINS } from "./chains";
import type { Chain } from "./chains";
import "./ChainReaction.css";

type Phase = "setup" | "playing" | "won";
type LengthKey = "quick" | "normal" | "long";

interface WordState {
  word: string;
  revealed: boolean;
  lettersShown: number; // hint count; last letter is never shown
}

interface Props {
  onQuit?: () => void;
}

const LENGTH_LABELS: Record<LengthKey, string> = {
  quick:  "QUICK  (4 words)",
  normal: "NORMAL (6 words)",
  long:   "LONG   (8 words)",
};

export default function ChainReaction({ onQuit }: Props) {
  const [phase, setPhase]           = useState<Phase>("setup");
  const [lengthKey, setLengthKey]   = useState<LengthKey>("normal");
  const [chain, setChain]           = useState<Chain | null>(null);
  const [words, setWords]           = useState<WordState[]>([]);
  const [turns, setTurns]           = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [totalTurns, setTotalTurns] = useState(0);
  const [roundNum, setRoundNum]     = useState(1);
  const [usedIds, setUsedIds]       = useState<string[]>([]);

  // Modal state
  const [modalIdx, setModalIdx] = useState<number | null>(null);
  const [guess, setGuess]       = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Menu bar ──────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => {
    const quitItems: MenuBarMenu["items"] = onQuit
      ? [{ separator: true }, { label: "Quit", onClick: onQuit }]
      : [];
    return [
      {
        label: "Game",
        items: [
          {
            label: "New Game",
            onClick: () => {
              setTotalScore(0);
              setTotalTurns(0);
              setRoundNum(1);
              setUsedIds([]);
              setPhase("setup");
            },
          },
          { separator: true },
          {
            label: "Quick (4 words)",
            checked: lengthKey === "quick",
            onClick: () => setLengthKey("quick"),
          },
          {
            label: "Normal (6 words)",
            checked: lengthKey === "normal",
            onClick: () => setLengthKey("normal"),
          },
          {
            label: "Long (8 words)",
            checked: lengthKey === "long",
            onClick: () => setLengthKey("long"),
          },
          ...quitItems,
        ],
      },
    ];
  }, [lengthKey, onQuit]);

  useWindowMenus(menus);

  // ── Focus input when modal opens ──────────────────────────────────────────

  useEffect(() => {
    if (modalIdx !== null) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [modalIdx]);

  // ── Game logic ────────────────────────────────────────────────────────────

  function startRound(lk: LengthKey) {
    const pool = CHAINS[lk];
    const available = pool.filter((_, i) => !usedIds.includes(`${lk}-${i}`));
    const from = available.length > 0 ? available : pool;
    const pick = from[Math.floor(Math.random() * from.length)];
    const globalIdx = pool.indexOf(pick);

    setUsedIds(prev => [...prev, `${lk}-${globalIdx}`]);
    setChain(pick);
    setWords(
      pick.words.map((w, i) => ({
        word: w,
        revealed: i === 0 || i === pick.words.length - 1,
        lettersShown: 0,
      }))
    );
    setTurns(0);
    setRoundScore(0);
    setPhase("playing");
    setModalIdx(null);
    setGuess("");
    setFeedback(null);
  }

  function getFrontier(): number[] {
    const result: number[] = [];
    for (let i = 1; i < words.length - 1; i++) {
      if (!words[i].revealed && (words[i - 1].revealed || words[i + 1].revealed)) {
        result.push(i);
      }
    }
    return result;
  }

  function handleRevealClick(idx: number) {
    const w = words[idx];
    const maxShown = w.word.length - 1;
    setWords(prev =>
      prev.map((wd, i) =>
        i === idx
          ? { ...wd, lettersShown: Math.min(wd.lettersShown + 1, maxShown) }
          : wd
      )
    );
    setTurns(t => t + 1);
    setModalIdx(idx);
    setGuess("");
    setFeedback(null);
  }

  function handleGuessSubmit() {
    if (modalIdx === null || !chain) return;
    const w = words[modalIdx];
    if (guess.trim().toLowerCase() === w.word.toLowerCase()) {
      const pts = w.word.length - w.lettersShown;
      const newRoundScore = roundScore + pts;
      const newWords = words.map((wd, i) =>
        i === modalIdx ? { ...wd, revealed: true } : wd
      );
      setRoundScore(newRoundScore);
      setWords(newWords);
      setModalIdx(null);
      setGuess("");
      setFeedback(null);

      if (newWords.every(wd => wd.revealed)) {
        const finalTurns = turns + 1;
        setTotalScore(s => s + newRoundScore);
        setTotalTurns(t => t + finalTurns);
        setPhase("won");
      }
    } else {
      setFeedback("Not quite — pick a word to reveal another letter.");
      setModalIdx(null);
      setGuess("");
    }
  }

  function handleContinue() {
    setRoundNum(n => n + 1);
    startRound(lengthKey);
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderCells(state: WordState, variant: "start" | "end" | "mystery") {
    return state.word.split("").map((ch, j) => {
      let cls: string;
      if (state.revealed) {
        cls =
          variant === "start" ? "cr__cell--start" :
          variant === "end"   ? "cr__cell--end"   :
                                "cr__cell--solved";
      } else {
        cls = j < state.lettersShown ? "cr__cell--hint" : "cr__cell--blank";
      }
      const showChar = state.revealed || j < state.lettersShown;
      return (
        <span key={j} className={`cr__cell ${cls}`}>
          {showChar ? ch.toUpperCase() : ""}
        </span>
      );
    });
  }

  // ── Setup screen ──────────────────────────────────────────────────────────

  if (phase === "setup") {
    return (
      <div className="cr cr--setup">
        <div className="cr__setup-title">CHAIN REACTION</div>
        <p className="cr__setup-desc">
          Connect START to END through a chain of compound words and phrases.
          Adjacent words form a word or expression together.
          Click a frontier word to reveal a letter, then guess!
        </p>
        <div className="cr__setup-label">Chain length:</div>
        <div className="cr__setup-options">
          {(["quick", "normal", "long"] as LengthKey[]).map(lk => (
            <button
              key={lk}
              className={`cr__setup-btn${lengthKey === lk ? " cr__setup-btn--active" : ""}`}
              onClick={() => setLengthKey(lk)}
            >
              {LENGTH_LABELS[lk]}
            </button>
          ))}
        </div>
        {totalScore > 0 && (
          <div className="cr__setup-score">
            Running: {totalScore} pts / {totalTurns} turns
            {" "}= {(totalScore / totalTurns).toFixed(2)} efficiency
          </div>
        )}
        <button
          className="cr__primary-btn"
          onClick={() => startRound(lengthKey)}
        >
          {totalScore > 0 ? "NEXT ROUND" : "START GAME"}
        </button>
      </div>
    );
  }

  // ── Won screen ────────────────────────────────────────────────────────────

  if (phase === "won" && chain) {
    const efficiency = totalTurns > 0 ? totalScore / totalTurns : 0;
    return (
      <div className="cr cr--won">
        <div className="cr__won-banner">CHAIN COMPLETE!</div>
        <div className="cr__won-stats">
          <span>Round {roundNum}</span>
          <span>Score: {roundScore} pts</span>
          <span>Turns: {turns + 1}</span>
        </div>

        <div className="cr__won-chain">
          {chain.words.map((w, i) => {
            const isStart = i === 0;
            const isEnd   = i === chain.words.length - 1;
            const cls     = isStart ? "cr__cell--start" : isEnd ? "cr__cell--end" : "cr__cell--solved";
            return (
              <div key={i} className="cr__won-entry">
                {i > 0 && (
                  <div className="cr__won-pair">
                    <span className="cr__won-pair-display">
                      {chain.pairs[i - 1].display}
                    </span>
                    {chain.pairs[i - 1].hint && (
                      <span className="cr__won-pair-hint">
                        {chain.pairs[i - 1].hint}
                      </span>
                    )}
                  </div>
                )}
                <div className="cr__cells">
                  {w.split("").map((ch, j) => (
                    <span key={j} className={`cr__cell ${cls}`}>
                      {ch.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="cr__won-total">
          Total: {totalScore} pts / {totalTurns} turns
          {" "}= <strong>{efficiency.toFixed(2)}</strong> efficiency
        </div>

        <div className="cr__won-buttons">
          <button className="cr__primary-btn" onClick={handleContinue}>
            NEXT ROUND
          </button>
          <button
            className="cr__secondary-btn"
            onClick={() => {
              setTotalScore(0);
              setTotalTurns(0);
              setRoundNum(1);
              setUsedIds([]);
              setPhase("setup");
            }}
          >
            NEW GAME
          </button>
        </div>
      </div>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────────

  const frontier = new Set<number>(getFrontier());

  return (
    <div className="cr cr--playing">
      {/* Status bar */}
      <div className="cr__status">
        <span className="cr__status-item">
          Round <strong>{roundNum}</strong>
        </span>
        <span className="cr__status-item">
          Score <strong>{roundScore}</strong>
        </span>
        <span className="cr__status-item">
          Turns <strong>{turns}</strong>
        </span>
        {totalScore > 0 && (
          <span className="cr__status-total">
            Total {totalScore}/{totalTurns}
          </span>
        )}
      </div>

      {/* Chain display */}
      <div className="cr__chain">
        {words.map((w, i) => {
          const isStart   = i === 0;
          const isEnd     = i === words.length - 1;
          const isFrontier = frontier.has(i);
          const variant: "start" | "end" | "mystery" =
            isStart ? "start" : isEnd ? "end" : "mystery";

          const rowInner = (
            <>
              <span className="cr__word-label">
                {isStart ? "START" : isEnd ? "END" : ""}
              </span>
              <div className="cr__cells">{renderCells(w, variant)}</div>
            </>
          );

          return (
            <div key={i} className="cr__word-entry">
              {i > 0 && <div className="cr__connector">▼</div>}
              {isFrontier ? (
                <button
                  className="cr__word-row cr__word-row--frontier"
                  onClick={() => handleRevealClick(i)}
                  title="Reveal a letter and guess this word"
                >
                  {rowInner}
                  <span className="cr__frontier-arrow">▶</span>
                </button>
              ) : (
                <div
                  className={`cr__word-row${
                    !w.revealed && !isStart && !isEnd ? " cr__word-row--locked" : ""
                  }`}
                >
                  {rowInner}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Wrong-guess feedback (shown after modal closes) */}
      {feedback && modalIdx === null && (
        <div className="cr__feedback">{feedback}</div>
      )}

      {/* Guess modal */}
      {modalIdx !== null && chain && (
        <div
          className="cr__modal-overlay"
          onClick={() => {
            setModalIdx(null);
            setGuess("");
            setFeedback(null);
          }}
        >
          <div className="cr__modal" onClick={e => e.stopPropagation()}>
            {/* Word above */}
            <div className="cr__modal-context">
              <div className="cr__cells">
                {renderCells(
                  words[modalIdx - 1],
                  modalIdx - 1 === 0 ? "start" : "mystery"
                )}
              </div>
            </div>

            <div className="cr__modal-arrow">▼</div>

            {/* Mystery word being guessed */}
            <div className="cr__modal-word">
              <div className="cr__cells">
                {renderCells(words[modalIdx], "mystery")}
              </div>
              <div className="cr__modal-hint-count">
                {words[modalIdx].lettersShown === 0
                  ? "No letters revealed yet"
                  : words[modalIdx].lettersShown === words[modalIdx].word.length - 1
                  ? "No more letters to reveal"
                  : `${words[modalIdx].lettersShown} letter${words[modalIdx].lettersShown !== 1 ? "s" : ""} revealed`}
              </div>
            </div>

            <div className="cr__modal-arrow">▼</div>

            {/* Word below */}
            <div className="cr__modal-context">
              <div className="cr__cells">
                {renderCells(
                  words[modalIdx + 1],
                  modalIdx + 1 === words.length - 1 ? "end" : "mystery"
                )}
              </div>
            </div>

            {/* Input */}
            <div className="cr__modal-input-row">
              <input
                ref={inputRef}
                className="cr__modal-input"
                type="text"
                value={guess}
                onChange={e => {
                  setGuess(e.target.value);
                  if (feedback) setFeedback(null);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") handleGuessSubmit();
                  if (e.key === "Escape") {
                    setModalIdx(null);
                    setGuess("");
                    setFeedback(null);
                  }
                }}
                placeholder="Your guess..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button className="cr__modal-guess-btn" onClick={handleGuessSubmit}>
                GUESS
              </button>
            </div>

            {feedback && (
              <div className="cr__modal-feedback">{feedback}</div>
            )}

            <button
              className="cr__modal-cancel"
              onClick={() => {
                setModalIdx(null);
                setGuess("");
                setFeedback(null);
              }}
            >
              Cancel (pick another word)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
