import { useState, useRef, useEffect, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { generateChain, type ChainResult } from "./chainUtils";
import type { Pair } from "./pairs";
import "./ChainReaction.css";

type Phase = "setup" | "playing" | "won";
type LengthKey = "quick" | "normal" | "long";

const LENGTH_WORDS: Record<LengthKey, number> = { quick: 4, normal: 6, long: 8 };
const LENGTH_LABELS: Record<LengthKey, string> = {
  quick:  "QUICK  (4 words)",
  normal: "NORMAL (6 words)",
  long:   "LONG   (8 words)",
};

interface WordState {
  word: string;
  revealed: boolean;
  hintsShown: number;
}

interface Props {
  onQuit?: () => void;
}

export default function ChainReaction({ onQuit }: Props) {
  const [phase, setPhase]               = useState<Phase>("setup");
  const [lengthKey, setLengthKey]       = useState<LengthKey>("normal");
  const [chainResult, setChainResult]   = useState<ChainResult | null>(null);
  const [words, setWords]               = useState<WordState[]>([]);
  const [turns, setTurns]               = useState(0);
  const [roundScore, setRoundScore]     = useState(0);
  const [totalScore, setTotalScore]     = useState(0);
  const [totalTurns, setTotalTurns]     = useState(0);
  const [roundNum, setRoundNum]         = useState(1);
  const [usedSeeds, setUsedSeeds]       = useState<Set<string>>(new Set<string>());

  const [modalIdx, setModalIdx]         = useState<number | null>(null);
  const [guess, setGuess]               = useState("");
  const [feedback, setFeedback]         = useState<string | null>(null);
  const [explainPair, setExplainPair]   = useState<Pair | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Menus ─────────────────────────────────────────────────────────────────

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
              setTotalScore(0); setTotalTurns(0);
              setRoundNum(1); setUsedSeeds(new Set<string>());
              setPhase("setup");
            },
          },
          { separator: true },
          { label: "Quick (4 words)",  checked: lengthKey === "quick",  onClick: () => setLengthKey("quick") },
          { label: "Normal (6 words)", checked: lengthKey === "normal", onClick: () => setLengthKey("normal") },
          { label: "Long (8 words)",   checked: lengthKey === "long",   onClick: () => setLengthKey("long") },
          ...quitItems,
        ],
      },
    ];
  }, [lengthKey, onQuit]);

  useWindowMenus(menus);

  useEffect(() => {
    if (modalIdx !== null) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [modalIdx]);

  // ── Game logic ────────────────────────────────────────────────────────────

  function startRound(lk: LengthKey) {
    const target = LENGTH_WORDS[lk];
    const result = generateChain(target, usedSeeds);
    if (!result) {
      setFeedback("No more unique chains available. Start a new game!");
      return;
    }
    const seed = result.words[0];
    setUsedSeeds(prev => new Set<string>([...prev, seed]));
    setChainResult(result);
    setWords(
      result.words.map((w, i) => ({
        word: w,
        revealed: i === 0 || i === result.words.length - 1,
        hintsShown: 0,
      }))
    );
    setTurns(0);
    setRoundScore(0);
    setPhase("playing");
    setModalIdx(null);
    setGuess("");
    setFeedback(null);
  }

  function getFrontier(): Set<number> {
    const s = new Set<number>();
    for (let i = 1; i < words.length - 1; i++) {
      if (!words[i].revealed && (words[i - 1].revealed || words[i + 1].revealed)) {
        s.add(i);
      }
    }
    return s;
  }

  function handleFrontierClick(idx: number) {
    const w = words[idx];
    const maxHints = w.word.length - 1;
    setWords(prev =>
      prev.map((wd, i) =>
        i === idx ? { ...wd, hintsShown: Math.min(wd.hintsShown + 1, maxHints) } : wd
      )
    );
    setTurns(t => t + 1);
    setModalIdx(idx);
    setGuess("");
    setFeedback(null);
  }

  function handleGuessSubmit() {
    if (modalIdx === null || !chainResult) return;
    const w = words[modalIdx];
    if (guess.trim().toLowerCase() === w.word.toLowerCase()) {
      const pts = w.word.length - w.hintsShown;
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

  // ── Cell rendering ────────────────────────────────────────────────────────

  function renderCells(state: WordState, variant: "start" | "end" | "mystery") {
    if (state.revealed) {
      const cls =
        variant === "start" ? "cr__cell--start" :
        variant === "end"   ? "cr__cell--end"   : "cr__cell--solved";
      return state.word.split("").map((ch, j) => (
        <span key={j} className={`cr__cell ${cls}`}>{ch.toUpperCase()}</span>
      ));
    }
    // Unrevealed: N hint cells + 1 blank (never reveal word length)
    const cells: JSX.Element[] = [];
    for (let j = 0; j < state.hintsShown; j++) {
      cells.push(
        <span key={j} className="cr__cell cr__cell--hint">
          {state.word[j].toUpperCase()}
        </span>
      );
    }
    cells.push(<span key="blank" className="cr__cell cr__cell--blank">&nbsp;</span>);
    return cells;
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
        {feedback && <div className="cr__feedback">{feedback}</div>}
        <button className="cr__primary-btn" onClick={() => startRound(lengthKey)}>
          {totalScore > 0 ? "NEXT ROUND" : "START GAME"}
        </button>
      </div>
    );
  }

  // ── Won screen ────────────────────────────────────────────────────────────

  if (phase === "won" && chainResult) {
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
          {chainResult.words.map((w, i) => {
            const isStart = i === 0;
            const isEnd   = i === chainResult.words.length - 1;
            const cls     = isStart ? "cr__cell--start" : isEnd ? "cr__cell--end" : "cr__cell--solved";
            return (
              <div key={i} className="cr__won-entry">
                {i > 0 && (
                  <div className="cr__won-pair">
                    <span className="cr__won-pair-display">
                      {chainResult.pairs[i - 1].a} + {chainResult.pairs[i - 1].b}
                    </span>
                    <button
                      className="cr__explain-btn"
                      title="See explanation"
                      onClick={() => setExplainPair(chainResult.pairs[i - 1])}
                    >
                      ❓
                    </button>
                  </div>
                )}
                <div className="cr__cells">
                  {w.split("").map((ch, j) => (
                    <span key={j} className={`cr__cell ${cls}`}>{ch.toUpperCase()}</span>
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
          <button className="cr__primary-btn" onClick={handleContinue}>NEXT ROUND</button>
          <button
            className="cr__secondary-btn"
            onClick={() => {
              setTotalScore(0); setTotalTurns(0);
              setRoundNum(1); setUsedSeeds(new Set<string>());
              setPhase("setup");
            }}
          >
            NEW GAME
          </button>
        </div>

        {explainPair && (
          <ExplainModal pair={explainPair} onClose={() => setExplainPair(null)} />
        )}
      </div>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────────

  const frontier = getFrontier();

  return (
    <div className="cr cr--playing">
      <div className="cr__status">
        <span className="cr__status-item">Round <strong>{roundNum}</strong></span>
        <span className="cr__status-item">Score <strong>{roundScore}</strong></span>
        <span className="cr__status-item">Turns <strong>{turns}</strong></span>
        {totalScore > 0 && (
          <span className="cr__status-total">Total {totalScore}/{totalTurns}</span>
        )}
      </div>

      <div className="cr__chain">
        {words.map((w, i) => {
          const isStart    = i === 0;
          const isEnd      = i === words.length - 1;
          const isFrontier = frontier.has(i);
          const variant: "start" | "end" | "mystery" =
            isStart ? "start" : isEnd ? "end" : "mystery";
          const showExplain = i > 0 && words[i - 1].revealed && w.revealed && chainResult;

          return (
            <div key={i} className="cr__word-entry">
              {i > 0 && (
                <div className="cr__connector-row">
                  <div className="cr__connector">▼</div>
                  {showExplain ? (
                    <button
                      className="cr__explain-btn"
                      title="See explanation"
                      onClick={() => setExplainPair(chainResult!.pairs[i - 1])}
                    >
                      ❓
                    </button>
                  ) : (
                    <span className="cr__explain-placeholder" />
                  )}
                </div>
              )}

              {isFrontier ? (
                <button
                  className="cr__word-row cr__word-row--frontier"
                  onClick={() => handleFrontierClick(i)}
                  title="Reveal a letter and guess this word"
                >
                  <span className="cr__word-label">{isStart ? "START" : isEnd ? "END" : ""}</span>
                  <div className="cr__cells">{renderCells(w, variant)}</div>
                  <span className="cr__frontier-arrow">▶</span>
                </button>
              ) : (
                <div className={`cr__word-row${!w.revealed && !isStart && !isEnd ? " cr__word-row--locked" : ""}`}>
                  <span className="cr__word-label">{isStart ? "START" : isEnd ? "END" : ""}</span>
                  <div className="cr__cells">{renderCells(w, variant)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {feedback && modalIdx === null && (
        <div className="cr__feedback">{feedback}</div>
      )}

      {modalIdx !== null && chainResult && (
        <div
          className="cr__modal-overlay"
          onClick={() => { setModalIdx(null); setGuess(""); setFeedback(null); }}
        >
          <div className="cr__modal" onClick={e => e.stopPropagation()}>
            <div className="cr__modal-context">
              <div className="cr__cells">
                {renderCells(words[modalIdx - 1], modalIdx - 1 === 0 ? "start" : "mystery")}
              </div>
            </div>

            <div className="cr__modal-arrow">▼</div>

            <div className="cr__modal-word">
              <div className="cr__cells">{renderCells(words[modalIdx], "mystery")}</div>
              <div className="cr__modal-hint-count">
                {words[modalIdx].hintsShown === 0
                  ? "No letters revealed yet"
                  : words[modalIdx].hintsShown === words[modalIdx].word.length - 1
                  ? "No more letters to reveal"
                  : `${words[modalIdx].hintsShown} letter${words[modalIdx].hintsShown !== 1 ? "s" : ""} revealed`}
              </div>
            </div>

            <div className="cr__modal-arrow">▼</div>

            <div className="cr__modal-context">
              <div className="cr__cells">
                {renderCells(
                  words[modalIdx + 1],
                  modalIdx + 1 === words.length - 1 ? "end" : "mystery"
                )}
              </div>
            </div>

            <div className="cr__modal-input-row">
              <input
                ref={inputRef}
                className="cr__modal-input"
                type="text"
                value={guess}
                onChange={e => { setGuess(e.target.value); if (feedback) setFeedback(null); }}
                onKeyDown={e => {
                  if (e.key === "Enter") handleGuessSubmit();
                  if (e.key === "Escape") { setModalIdx(null); setGuess(""); setFeedback(null); }
                }}
                placeholder="Your guess..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button className="cr__modal-guess-btn" onClick={handleGuessSubmit}>GUESS</button>
            </div>

            {feedback && <div className="cr__modal-feedback">{feedback}</div>}

            <button
              className="cr__modal-cancel"
              onClick={() => { setModalIdx(null); setGuess(""); setFeedback(null); }}
            >
              Cancel (pick another word)
            </button>
          </div>
        </div>
      )}

      {explainPair && (
        <ExplainModal pair={explainPair} onClose={() => setExplainPair(null)} />
      )}
    </div>
  );
}

// ── Explanation modal ──────────────────────────────────────────────────────

function ExplainModal({ pair, onClose }: { pair: Pair; onClose: () => void }) {
  return (
    <div className="cr__modal-overlay" onClick={onClose}>
      <div className="cr__modal cr__modal--explain" onClick={e => e.stopPropagation()}>
        <div className="cr__explain-title">
          {pair.a}&nbsp;+&nbsp;{pair.b}
        </div>
        <div className="cr__explain-body">{pair.explanation}</div>
        <button className="cr__modal-cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
