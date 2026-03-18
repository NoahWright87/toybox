import { useState, useEffect, useRef } from "react";
import "./TypingRacer.css";

const PHRASES = [
  "The quick brown fox jumps over the lazy dog.",
  "Pack my box with five dozen liquor jugs.",
  "How vexingly quick daft zebras jump!",
  "The five boxing wizards jump quickly.",
  "Sphinx of black quartz, judge my vow.",
  "Two driven jocks help fax my big quiz.",
  "Five quacking zephyrs jolt my wax bed.",
  "Jackdaws love my big sphinx of quartz.",
  "Blowzy red vixens fight for a quick jump.",
  "The jay, pig, fox, zebra, and my wolves quack!",
  "Bright vixens jump dozy fowl quack.",
  "Woven silk pyjamas exchanged for blue quartz.",
];

function pickPhrase(): string {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

export default function TypingRacer() {
  const [phrase, setPhrase] = useState(pickPhrase);
  const [typed, setTyped] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [finishTime, setFinishTime] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const elapsed =
    finishTime && startTime
      ? (finishTime - startTime) / 1000
      : startTime
      ? (Date.now() - startTime) / 1000
      : 0;

  const wpm =
    startTime && typed.length > 0
      ? Math.round((typed.length / 5) / Math.max(elapsed / 60, 0.001))
      : 0;

  const correctChars = typed.split("").filter((c, i) => c === phrase[i]).length;
  const accuracy =
    typed.length > 0 ? Math.round((correctChars / typed.length) * 100) : 100;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (value.length > phrase.length) return;

    if (!startTime && value.length > 0) {
      setStartTime(Date.now());
    }

    setTyped(value);

    if (value === phrase) {
      setFinishTime(Date.now());
    }
  }

  function reset() {
    setPhrase(pickPhrase());
    setTyped("");
    setStartTime(null);
    setFinishTime(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="typing-racer">
      <div className="typing-racer__stats">
        <span>{wpm} WPM</span>
        <span>{accuracy}% accuracy</span>
        {startTime && !finishTime && (
          <span className="typing-racer__timer">{elapsed.toFixed(1)}s</span>
        )}
      </div>

      <div className="typing-racer__phrase" aria-hidden="true">
        {phrase.split("").map((char, i) => {
          let cls = "typing-racer__char";
          if (i < typed.length) {
            cls +=
              typed[i] === char
                ? " typing-racer__char--correct"
                : " typing-racer__char--wrong";
          } else if (i === typed.length) {
            cls += " typing-racer__char--cursor";
          }
          return (
            <span key={i} className={cls}>
              {char}
            </span>
          );
        })}
      </div>

      {finishTime ? (
        <div className="typing-racer__result">
          <div className="typing-racer__result-stats">
            <div>
              <div className="typing-racer__result-value">{wpm}</div>
              <div className="typing-racer__result-label">WPM</div>
            </div>
            <div>
              <div className="typing-racer__result-value">{accuracy}%</div>
              <div className="typing-racer__result-label">accuracy</div>
            </div>
            <div>
              <div className="typing-racer__result-value">
                {((finishTime - startTime!) / 1000).toFixed(2)}s
              </div>
              <div className="typing-racer__result-label">time</div>
            </div>
          </div>
          <button className="typing-racer__reset" onClick={reset}>
            Try again
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          className="typing-racer__input"
          value={typed}
          onChange={handleChange}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Start typing…"
        />
      )}
    </div>
  );
}
