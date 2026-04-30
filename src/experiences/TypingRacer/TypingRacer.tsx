import { useState, useEffect, useRef, useCallback } from "react";
import "./TypingRacer.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";
type Phase = "menu" | "playing" | "gameover";

interface FallingWord {
  id: number;
  text: string;
  x: number;
  y: number;
  speed: number;
  penalty: number;
  typed: number;
}

interface Bullet {
  id: number;
  x: number;
  fromY: number;
  toY: number;
  progress: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface WpmSample {
  wpm: number;
}

interface GameState {
  words: FallingWord[];
  bullets: Bullet[];
  particles: Particle[];
  stars: Array<{ x: number; y: number; r: number; b: number }>;
  targetId: number | null;
  lives: number;
  score: number;
  charsTyped: number;
  wordsDestroyed: number;
  startTime: number;
  lastSpawnTime: number;
  wpm: number;
  wpmHistory: WpmSample[];
  lastWpmUpdate: number;
  nextId: number;
  difficulty: Difficulty;
  lastFrameTime: number;
  shipFlash: number;
}

interface FinalStats {
  score: number;
  wpm: number;
  wordsDestroyed: number;
  isNewRecord: boolean;
}

// ─── Word lists ──────────────────────────────────────────────────────────────

const WORDS: Record<Difficulty, string[]> = {
  easy: [
    "cat","dog","fox","bat","ant","bee","fly","owl","rat","elk",
    "run","hop","zip","zap","pop","top","map","cap","cup","box",
    "big","bit","hit","sit","fit","tip","dip","rip","sip","lip",
    "ham","jam","ram","yam","can","ban","fan","man","pan","ran",
    "red","bed","fed","led","wed","net","set","let","met","jet",
    "hot","lot","pot","dot","got","bug","mug","rug","tug","dug",
    "lag","rag","sag","tag","wag","bag","arm","arc","ash","ace",
    "age","air","ale","aim","axe","bow","cog","cub","dam","den",
    "dew","dye","eel","egg","elm","era","eve","ewe","eye","fad",
    "foe","fog","fur","gag","gap","gem","gin","gnu","hag","hay",
  ],
  medium: [
    "brick","clock","dream","flame","ghost","joker","knife","laser",
    "magic","night","orbit","pixel","queen","robot","storm","tiger",
    "alpha","blaze","champ","delta","elite","frost","globe","hydra",
    "blast","cyber","disco","ember","forge","grind","haste","ionic",
    "jumbo","karma","light","metal","ninja","ozone","prowl","quirk",
    "racer","shift","solar","turbo","vivid","craze","drive","epoch",
    "flick","graze","helix","irony","jelly","knack","lemon","mango",
    "nerve","oxide","piano","quill","raven","scout","thump","ultra",
    "valor","woven","xerox","yield","zilch","amber","blunt","crisp",
    "decoy","elder","flare","glyph","haven","inbox","joust","karma",
  ],
  hard: [
    "algorithm","bandwidth","compiler","database","endpoint",
    "firewall","graphics","hardware","internet","keyboard",
    "megabyte","overflow","password","quantize","register",
    "software","terminal","username","variable","wireless",
    "bootstrap","codeblock","download","encrypted","framework",
    "gigahertz","hyperlink","interface","kilobyte","localhost",
    "megahertz","namespace","objective","processor","quicksort",
    "recursive","shellcode","timestamp","undefined","vectorize",
    "webmaster","xdebugger","yottabyte","zeropoint","archetype",
    "benchmark","cacheline","debugmode","eventloop","firstbyte",
  ],
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CW = 560;
const CH = 480;
const HUD_H = 60;
const SHIP_Y = CH - 80; // 400
const MAX_LIVES = 3;
const CHAR_W = 8.5;

const DIFF: Record<Difficulty, {
  speedMin: number;
  speedMax: number;
  spawnMs: number;
  maxWords: number;
  penalty: number;
}> = {
  easy:   { speedMin: 28,  speedMax: 50,  spawnMs: 3500, maxWords: 3, penalty: 45  },
  medium: { speedMin: 50,  speedMax: 82,  spawnMs: 2400, maxWords: 4, penalty: 70  },
  hard:   { speedMin: 82,  speedMax: 120, spawnMs: 1700, maxWords: 5, penalty: 100 },
};

const PARTICLE_COLORS = ["#ff6600", "#ffcc00", "#ff3300", "#ffffff", "#ff8833"];

// ─── Module-level helpers ─────────────────────────────────────────────────────

function calcWpm(chars: number, startTime: number): number {
  const mins = (Date.now() - startTime) / 60000;
  if (mins < 0.01) return 0;
  return Math.round((chars / 5) / mins);
}

function spawnWord(state: GameState): void {
  const cfg = DIFF[state.difficulty];
  const list = WORDS[state.difficulty];
  const existing = new Set<string>(state.words.map(w => w.text));

  let text = list[Math.floor(Math.random() * list.length)];
  for (let i = 0; i < 10 && existing.has(text); i++) {
    text = list[Math.floor(Math.random() * list.length)];
  }

  const half = (text.length * CHAR_W) / 2;
  const margin = half + 20;
  const x = margin + Math.random() * (CW - margin * 2);
  const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);

  state.words.push({
    id: state.nextId++,
    text,
    x,
    y: HUD_H - 10,
    speed,
    penalty: 0,
    typed: 0,
  });
}

function burstParticles(state: GameState, x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const spd = 50 + Math.random() * 100;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    });
  }
}

function drawShip(ctx: CanvasRenderingContext2D, flash: number): void {
  const cx = CW / 2;
  const cy = SHIP_Y;

  ctx.save();

  // Thruster flame (randomized height for animation effect)
  const flameH = 8 + Math.random() * 10;
  ctx.fillStyle = "rgba(255,140,0,0.85)";
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + 18);
  ctx.lineTo(cx, cy + 18 + flameH);
  ctx.lineTo(cx + 5, cy + 18);
  ctx.closePath();
  ctx.fill();

  // Color shift on hit
  const r = flash > 0 ? Math.min(255, Math.floor(180 + 75 * flash)) : 180;
  const g = flash > 0 ? Math.floor(100 * (1 - flash)) : 100;
  const b = flash > 0 ? Math.floor(60 * (1 - flash))  : 60;

  // Wings
  const wr = Math.floor(r * 0.55);
  const wg = Math.floor(g * 0.55);
  const wb = Math.floor(b * 0.55);
  ctx.fillStyle = `rgb(${wr},${wg},${wb})`;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 6);
  ctx.lineTo(cx - 30, cy + 22);
  ctx.lineTo(cx - 6,  cy + 18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy + 6);
  ctx.lineTo(cx + 30, cy + 22);
  ctx.lineTo(cx + 6,  cy + 18);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.moveTo(cx,      cy - 26);
  ctx.lineTo(cx + 12, cy + 8);
  ctx.lineTo(cx + 8,  cy + 18);
  ctx.lineTo(cx - 8,  cy + 18);
  ctx.lineTo(cx - 12, cy + 8);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = "#44aaff";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cannon
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(cx - 2, cy - 34, 4, 12);

  ctx.restore();
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  lives: number,
  score: number,
  wpm: number,
  wpmHistory: WpmSample[],
  difficulty: Difficulty,
): void {
  // Background panel
  ctx.fillStyle = "#080820";
  ctx.fillRect(0, 0, CW, HUD_H);
  ctx.fillStyle = "#1a1a44";
  ctx.fillRect(0, HUD_H, CW, 1);

  ctx.textBaseline = "middle";

  // Lives
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.fillStyle = "#ff4444";
  const hearts = "♥".repeat(lives) + "♡".repeat(MAX_LIVES - lives);
  ctx.fillText(hearts, 10, 18);

  // Difficulty badge
  const diffColors: Record<Difficulty, string> = { easy: "#44cc44", medium: "#ffaa00", hard: "#ff4444" };
  ctx.fillStyle = diffColors[difficulty];
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillText(difficulty.toUpperCase(), 10, 34);

  // Score (centered)
  ctx.fillStyle = "#ffcc00";
  ctx.font = '9px "Press Start 2P", monospace';
  const scoreStr = String(score);
  const scoreW = ctx.measureText(scoreStr).width;
  ctx.fillText(scoreStr, CW / 2 - scoreW / 2, 18);

  // WPM label
  ctx.fillStyle = "#44ccff";
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = "right";
  ctx.fillText(`${wpm} WPM`, CW - 10, 18);
  ctx.textAlign = "left";

  // WPM mini line graph (top-right corner, below WPM label)
  if (wpmHistory.length > 1) {
    const gx = CW - 88;
    const gy = 30;
    const gw = 78;
    const gh = 22;
    const maxVal = Math.max(80, ...wpmHistory.map(s => s.wpm));

    ctx.strokeStyle = "rgba(68,204,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    wpmHistory.forEach((s, i) => {
      const px = gx + (i / (wpmHistory.length - 1)) * gw;
      const py = gy + gh - (s.wpm / maxVal) * gh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TypingRacer() {
  const [phase, setPhase]           = useState<Phase>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [highScore, setHighScore]   = useState<number>(() => {
    const s = localStorage.getItem("typeemup-highscore");
    return s ? parseInt(s, 10) : 0;
  });
  // gamePaused drives the "tap to play" strip; gamePausedRef is readable inside
  // the RAF loop without a stale-closure issue.
  const [gamePaused, setGamePaused] = useState(true);

  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const gameRef         = useRef<GameState | null>(null);
  const rafRef          = useRef<number>(0);
  const highScoreRef    = useRef(highScore);
  const gamePausedRef   = useRef(true);
  // The input is always in the DOM so iOS focus() works in a user-gesture handler.
  const inputRef        = useRef<HTMLInputElement>(null);
  // Prevents double-processing on desktop when both onKeyDown and onChange fire.
  const keyHandledRef   = useRef(false);

  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  // ── Pause / resume helpers ─────────────────────────────────────────────────

  const pauseGame = useCallback(() => {
    gamePausedRef.current = true;
    setGamePaused(true);
  }, []);

  const resumeGame = useCallback(() => {
    if (!gameRef.current) return;
    // Reset the frame timer so the first dt after a pause isn't huge.
    gameRef.current.lastFrameTime = performance.now();
    gamePausedRef.current = false;
    setGamePaused(false);
  }, []);

  // ── Core char processor (shared by desktop onKeyDown and mobile onChange) ──

  const processChar = useCallback((ch: string) => {
    const state = gameRef.current;
    if (!state) return;

    if (state.targetId !== null) {
      const target = state.words.find(w => w.id === state.targetId);
      if (!target) { state.targetId = null; return; }

      if (ch === target.text[target.typed]) {
        target.typed++;
        state.charsTyped++;

        state.bullets.push({
          id: state.nextId++,
          x: target.x,
          fromY: SHIP_Y - 34,
          toY: target.y,
          progress: 0,
        });

        if (target.typed === target.text.length) {
          state.wordsDestroyed++;
          state.score += target.text.length * 10 + Math.floor(target.speed);
          burstParticles(state, target.x, target.y, 14);
          state.words    = state.words.filter(w => w.id !== target.id);
          state.targetId = null;
        }
      } else {
        target.penalty += DIFF[state.difficulty].penalty;
      }
    } else {
      const candidates = state.words.filter(w => w.text[0] === ch && w.typed === 0);
      if (candidates.length === 0) return;

      const target = candidates.reduce((a, b) => (a.y > b.y ? a : b));
      state.targetId  = target.id;
      target.typed    = 1;
      state.charsTyped++;

      state.bullets.push({
        id: state.nextId++,
        x: target.x,
        fromY: SHIP_Y - 34,
        toY: target.y,
        progress: 0,
      });

      if (target.text.length === 1) {
        state.wordsDestroyed++;
        state.score += 10 + Math.floor(target.speed);
        burstParticles(state, target.x, target.y, 10);
        state.words    = state.words.filter(w => w.id !== target.id);
        state.targetId = null;
      }
    }
  }, []);

  // ── Input event handlers ───────────────────────────────────────────────────

  // Desktop: onKeyDown fires with a real key value. We preventDefault so the
  // character never reaches the input value (no onChange needed for desktop).
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "Escape") {
      cancelAnimationFrame(rafRef.current);
      setPhase("menu");
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();
      keyHandledRef.current = true;
      processChar(e.key.toLowerCase());
    }
  }, [processChar]);

  // Mobile: onKeyDown gives "Unidentified", so the character ends up in the
  // input value and onChange fires. We drain the value and clear the field.
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (keyHandledRef.current) {
      // Desktop path already processed this keystroke.
      keyHandledRef.current = false;
      e.target.value = "";
      return;
    }
    // Mobile path: one or more characters arrived via the IME / virtual keyboard.
    const val = e.target.value;
    for (const ch of val) {
      processChar(ch.toLowerCase());
    }
    e.target.value = "";
  }, [processChar]);

  const handleInputFocus = useCallback(() => {
    resumeGame();
  }, [resumeGame]);

  const handleInputBlur = useCallback(() => {
    pauseGame();
  }, [pauseGame]);

  // ── Game loop ──────────────────────────────────────────────────────────────

  const gameLoop = useCallback((timestamp: number) => {
    const state  = gameRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Update (skipped while paused) ────────────────────────────────────────
    if (!gamePausedRef.current) {
      const dt = Math.min((timestamp - state.lastFrameTime) / 1000, 0.05);
      state.lastFrameTime = timestamp;

      // WPM sample every second
      if (timestamp - state.lastWpmUpdate > 1000) {
        state.wpm = calcWpm(state.charsTyped, state.startTime);
        state.wpmHistory.push({ wpm: state.wpm });
        if (state.wpmHistory.length > 45) state.wpmHistory.shift();
        state.lastWpmUpdate = timestamp;
      }

      // Spawn words
      const cfg = DIFF[state.difficulty];
      if (timestamp - state.lastSpawnTime > cfg.spawnMs && state.words.length < cfg.maxWords) {
        spawnWord(state);
        state.lastSpawnTime = timestamp;
      }

      // Move words & detect hits
      const hitIds: number[] = [];
      for (const w of state.words) {
        w.y += (w.speed + w.penalty) * dt;
        w.penalty = Math.max(0, w.penalty - w.penalty * 3 * dt);
        if (w.y >= SHIP_Y - 10) hitIds.push(w.id);
      }

      // Process hits
      let died = false;
      for (const id of hitIds) {
        state.words = state.words.filter(w => w.id !== id);
        if (state.targetId === id) state.targetId = null;
        state.lives--;
        state.shipFlash = 1;
        if (state.lives <= 0) { died = true; break; }
      }

      if (died) {
        cancelAnimationFrame(rafRef.current);
        const finalWpm = calcWpm(state.charsTyped, state.startTime);
        const isNewRecord = state.score > highScoreRef.current;
        setFinalStats({ score: state.score, wpm: finalWpm, wordsDestroyed: state.wordsDestroyed, isNewRecord });
        if (isNewRecord) {
          localStorage.setItem("typeemup-highscore", String(state.score));
          setHighScore(state.score);
        }
        gameRef.current = null;
        setPhase("gameover");
        return;
      }

      // Decay ship flash
      if (state.shipFlash > 0) state.shipFlash = Math.max(0, state.shipFlash - dt * 3);

      // Advance bullets
      for (const b of state.bullets) b.progress += dt * 5;
      state.bullets = state.bullets.filter(b => b.progress < 1);

      // Advance particles
      for (const p of state.particles) {
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.vy += 120 * dt;
        p.life -= dt * 2;
      }
      state.particles = state.particles.filter(p => p.life > 0);
    }

    // ── Render (always, even while paused) ───────────────────────────────────

    ctx.fillStyle = "#06061a";
    ctx.fillRect(0, 0, CW, CH);

    for (const s of state.stars) {
      ctx.fillStyle = `rgba(255,255,255,${s.b})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    const dangerGrad = ctx.createLinearGradient(0, SHIP_Y - 50, 0, SHIP_Y + 30);
    dangerGrad.addColorStop(0, "rgba(180,0,0,0)");
    dangerGrad.addColorStop(1, "rgba(180,0,0,0.12)");
    ctx.fillStyle = dangerGrad;
    ctx.fillRect(0, SHIP_Y - 50, CW, 80);

    ctx.shadowColor = "#ff6600";
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = "#ff8833";
    for (const b of state.bullets) {
      const by = b.fromY + (b.toY - b.fromY) * b.progress;
      ctx.fillRect(b.x - 2, by - 6, 4, 12);
    }
    ctx.shadowBlur = 0;

    ctx.textBaseline = "middle";
    for (const word of state.words) {
      const isTarget = word.id === state.targetId;
      const half     = (word.text.length * CHAR_W) / 2;
      const startX   = word.x - half;

      for (let i = 0; i < word.text.length; i++) {
        const charX = startX + i * CHAR_W;

        if (i < word.typed) {
          ctx.fillStyle = "#33bb55";
          ctx.font = '14px "Courier New", monospace';
        } else if (isTarget && i === word.typed) {
          ctx.fillStyle = "#ffdd00";
          ctx.font = 'bold 14px "Courier New", monospace';
        } else if (isTarget) {
          ctx.fillStyle = "#ff8833";
          ctx.font = '14px "Courier New", monospace';
        } else {
          ctx.fillStyle = "#44bb66";
          ctx.font = '14px "Courier New", monospace';
        }

        ctx.fillText(word.text[i], charX, word.y);
      }

      if (!isTarget && word.typed === 0) {
        ctx.fillStyle = "#44bb66";
        ctx.fillRect(word.x - half, word.y + 10, CHAR_W, 1);
      }
    }

    for (const p of state.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    drawShip(ctx, state.shipFlash);
    drawHud(ctx, state.lives, state.score, state.wpm, state.wpmHistory, state.difficulty);

    rafRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // ── Start game ─────────────────────────────────────────────────────────────

  const startGame = useCallback((diff: Difficulty) => {
    cancelAnimationFrame(rafRef.current);

    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * CW,
      y: Math.random() * CH,
      r: Math.random() < 0.2 ? 2 : 1,
      b: 0.15 + Math.random() * 0.5,
    }));

    const now = performance.now();

    gameRef.current = {
      words: [],
      bullets: [],
      particles: [],
      stars,
      targetId: null,
      lives: MAX_LIVES,
      score: 0,
      charsTyped: 0,
      wordsDestroyed: 0,
      startTime: Date.now(),
      lastSpawnTime: now - DIFF[diff].spawnMs,
      wpm: 0,
      wpmHistory: [],
      lastWpmUpdate: 0,
      nextId: 1,
      difficulty: diff,
      lastFrameTime: now,
      shipFlash: 0,
    };

    // Start paused; the RAF loop renders a static first frame.
    // Game logic begins when the input receives focus.
    gamePausedRef.current = true;
    setGamePaused(true);
    setPhase("playing");
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // ── Global Escape listener (works even when input isn't focused) ───────────

  useEffect(() => {
    if (phase !== "playing") return;
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cancelAnimationFrame(rafRef.current);
        setPhase("menu");
      }
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [phase]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  // The <input> is always in the DOM (visibility:hidden when not playing) so
  // that focus() called synchronously inside a button click works on iOS.
  const inputEl = (
    <input
      ref={inputRef}
      className="teu__mobile-input"
      type="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      inputMode="text"
      tabIndex={phase === "playing" ? 0 : -1}
      aria-label="Type here to play"
      onFocus={handleInputFocus}
      onBlur={handleInputBlur}
      onKeyDown={handleInputKeyDown}
      onChange={handleInputChange}
    />
  );

  if (phase === "menu") {
    return (
      <div className="teu">
        {inputEl}
        <div className="teu__window">
          <div className="teu__titlebar">
            <span className="teu__titlebar-text">Type &#39;Em Up</span>
            <span className="teu__titlebar-dots">●●●</span>
          </div>
          <div className="teu__body">
            <div className="teu__logo">TYPE &#39;EM UP</div>
            <div className="teu__tagline">a typing shmup</div>

            {highScore > 0 && (
              <div className="teu__high-score">HI SCORE: {highScore}</div>
            )}

            <div className="teu__section-label">DIFFICULTY</div>
            <div className="teu__diff-row">
              {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                <button
                  key={d}
                  className={`teu__diff-btn${difficulty === d ? " teu__diff-btn--active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              className="teu__launch-btn"
              onClick={() => {
                startGame(difficulty);
                // Synchronous focus in the user-gesture handler — required for
                // iOS to show the virtual keyboard without an extra tap.
                inputRef.current?.focus();
              }}
            >
              LAUNCH
            </button>

            <div className="teu__tips">
              <p>Words fall from above &mdash; type them to shoot!</p>
              <p>Mistyping makes words fall faster.</p>
              <p>Don&#39;t let words reach your ship!</p>
              <p className="teu__tips-esc">ESC returns to menu.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "gameover") {
    return (
      <div className="teu">
        {inputEl}
        <div className="teu__window">
          <div className="teu__titlebar teu__titlebar--dead">
            <span className="teu__titlebar-text">GAME OVER</span>
            <span className="teu__titlebar-dots">●●●</span>
          </div>
          <div className="teu__body">
            <div className="teu__logo teu__logo--dead">GAME OVER</div>

            {finalStats?.isNewRecord && (
              <div className="teu__new-record">&#9733; NEW RECORD &#9733;</div>
            )}

            <div className="teu__stats-grid">
              <div className="teu__stat">
                <div className="teu__stat-val">{finalStats?.score ?? 0}</div>
                <div className="teu__stat-key">SCORE</div>
              </div>
              <div className="teu__stat">
                <div className="teu__stat-val">{finalStats?.wpm ?? 0}</div>
                <div className="teu__stat-key">WPM</div>
              </div>
              <div className="teu__stat">
                <div className="teu__stat-val">{finalStats?.wordsDestroyed ?? 0}</div>
                <div className="teu__stat-key">WORDS</div>
              </div>
            </div>

            {highScore > 0 && !finalStats?.isNewRecord && (
              <div className="teu__high-score">HI SCORE: {highScore}</div>
            )}

            <div className="teu__action-row">
              <button
                className="teu__launch-btn"
                onClick={() => {
                  startGame(difficulty);
                  inputRef.current?.focus();
                }}
              >
                RETRY
              </button>
              <button
                className="teu__launch-btn teu__launch-btn--secondary"
                onClick={() => setPhase("menu")}
              >
                MENU
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Playing phase
  return (
    <div className="teu">
      {inputEl}
      <div className="teu__game-wrapper">
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="teu__canvas"
        />
        {/* Tap strip — always visible below the canvas during play.
            Shows a "tap here" prompt when paused, a blinking cursor when active. */}
        <div
          className={`teu__type-strip${gamePaused ? " teu__type-strip--paused" : ""}`}
          onClick={() => inputRef.current?.focus()}
          role="button"
          aria-label="Tap to play"
        >
          {gamePaused
            ? <span className="teu__strip-label">&#9654; TAP TO PLAY</span>
            : <span className="teu__strip-cursor" aria-hidden="true" />
          }
        </div>
      </div>
    </div>
  );
}
