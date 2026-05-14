import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import "./DuckHunt.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase =
  | "title"
  | "category-select"
  | "difficulty-select"
  | "countdown"
  | "playing"
  | "round-result"
  | "game-over";

type MathCategory = "addition" | "multiplication" | "primes" | "squares";
type Difficulty = "easy" | "medium" | "hard";

interface PigeonState {
  id: number;
  label: string;
  isCorrect: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: "pending" | "flying" | "hit-correct" | "hit-wrong" | "escaped";
  hitTime: number | null;
  radius: number;
  launchDelay: number; // ms from roundStartTime before becoming "flying"
  launchX: number;
  launchY: number;
}

interface ShotEffect {
  x: number;
  y: number;
  createdAt: number;
  duration: number;
  kind: "correct" | "wrong" | "miss";
}

interface MutableLoop {
  pigeons: PigeonState[];
  effects: ShotEffect[];
  shotsLeft: number;
  score: number;
  lives: number;
  combo: number;
  roundStartTime: number;
  lastFrameTime: number;
  hitCorrect: number;
  hitWrong: number;
  totalCorrect: number;
  roundOver: boolean;
  category: MathCategory;
  difficulty: Difficulty;
}

interface RoundResult {
  hitCorrect: number;
  totalCorrect: number;
  hitWrong: number;
  gotAll: boolean;
  gotAtLeastOne: boolean;
  pointsDelta: number;
  lostLife: boolean;
}

interface HighScore {
  score: number;
  category: MathCategory;
  difficulty: Difficulty;
  date: string;
}

interface PigeonValue {
  label: string;
  isCorrect: boolean;
}

interface Question {
  prompt: string;
  values: PigeonValue[];
}

interface DiffConfig {
  numPigeons: number;
  numShots: number;
  launchSpeed: number;
  gravity: number;
  label: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CW = 720;
const CH = 360;
const TREELINE_H = 85;
const LS_KEY = "dh-high-scores-v1";

const DIFF_CONFIG: Record<Difficulty, DiffConfig> = {
  easy:   { numPigeons: 3, numShots: 4, launchSpeed: 155, gravity: 75,  label: "Easy" },
  medium: { numPigeons: 5, numShots: 3, launchSpeed: 210, gravity: 100, label: "Medium" },
  hard:   { numPigeons: 7, numShots: 3, launchSpeed: 290, gravity: 135, label: "Hard" },
};

const PRIMES_SMALL = [2, 3, 5, 7, 11, 13, 17, 19, 23];
const NON_PRIMES_SMALL = [1, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25];
const PRIMES_MED = [29, 31, 37, 41, 43, 47];
const NON_PRIMES_MED = [26, 27, 28, 30, 32, 33, 34, 35, 36, 38, 39, 40, 42, 44, 45, 46, 48, 49, 50];

const SQUARES_SMALL = [1, 4, 9, 16, 25, 36];
const NON_SQUARES_SMALL = [2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30];
const SQUARES_MED = [49, 64, 81, 100];
const NON_SQUARES_MED = [31, 32, 33, 34, 35, 37, 38, 39, 40, 42, 44, 45, 46, 48, 50, 56, 60, 72, 80, 90, 98, 99];

const CATEGORY_LABELS: Record<MathCategory, string> = {
  addition: "Addition",
  multiplication: "Multiplication",
  primes: "Prime Numbers",
  squares: "Perfect Squares",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// ─── Math Generation ──────────────────────────────────────────────────────────

function makeAdditionQuestion(diff: Difficulty, n: number): Question {
  const max = diff === "easy" ? 9 : diff === "medium" ? 19 : 49;
  const a = Math.floor(Math.random() * max) + 1;
  const b = Math.floor(Math.random() * max) + 1;
  const correct = a + b;
  const wrongSet = new Set<number>();
  let tries = 0;
  while (wrongSet.size < n - 1 && tries < 200) {
    tries++;
    const delta = Math.floor(Math.random() * 8) - 4;
    if (delta === 0) continue;
    const w = correct + delta;
    if (w > 0 && w !== correct) wrongSet.add(w);
  }
  const values: PigeonValue[] = shuffle([
    { label: String(correct), isCorrect: true },
    ...[...wrongSet].map((v) => ({ label: String(v), isCorrect: false })),
  ]).slice(0, n);
  return { prompt: `${a} + ${b} = ?`, values };
}

function makeMultiplyQuestion(diff: Difficulty, n: number): Question {
  const max = diff === "easy" ? 5 : diff === "medium" ? 9 : 12;
  const a = Math.floor(Math.random() * max) + 1;
  const b = Math.floor(Math.random() * max) + 1;
  const correct = a * b;
  const wrongSet = new Set<number>();
  let tries = 0;
  while (wrongSet.size < n - 1 && tries < 200) {
    tries++;
    const delta = Math.floor(Math.random() * 10) - 5;
    if (delta === 0) continue;
    const w = correct + delta;
    if (w > 0 && w !== correct) wrongSet.add(w);
  }
  const values: PigeonValue[] = shuffle([
    { label: String(correct), isCorrect: true },
    ...[...wrongSet].map((v) => ({ label: String(v), isCorrect: false })),
  ]).slice(0, n);
  return { prompt: `${a} × ${b} = ?`, values };
}

function makePrimesQuestion(diff: Difficulty, n: number): Question {
  const primePool = diff === "easy" ? PRIMES_SMALL : [...PRIMES_SMALL, ...PRIMES_MED];
  const nonPrimePool = diff === "easy" ? NON_PRIMES_SMALL : [...NON_PRIMES_SMALL, ...NON_PRIMES_MED];
  const numCorrect = 1 + Math.floor(Math.random() * Math.min(2, n - 2 < 1 ? 1 : n - 2));
  const correctPicks = pick(primePool, numCorrect);
  const wrongPicks = pick(nonPrimePool, n - numCorrect);
  const values: PigeonValue[] = shuffle([
    ...correctPicks.map((v) => ({ label: String(v), isCorrect: true })),
    ...wrongPicks.map((v) => ({ label: String(v), isCorrect: false })),
  ]);
  return { prompt: "Shoot prime numbers!", values };
}

function makeSquaresQuestion(diff: Difficulty, n: number): Question {
  const squaresPool = diff === "easy" ? SQUARES_SMALL : [...SQUARES_SMALL, ...SQUARES_MED];
  const nonSquaresPool = diff === "easy" ? NON_SQUARES_SMALL : [...NON_SQUARES_SMALL, ...NON_SQUARES_MED];
  const numCorrect = 1 + Math.floor(Math.random() * Math.min(2, n - 2 < 1 ? 1 : n - 2));
  const correctPicks = pick(squaresPool, numCorrect);
  const wrongPicks = pick(nonSquaresPool, n - numCorrect);
  const values: PigeonValue[] = shuffle([
    ...correctPicks.map((v) => ({ label: String(v), isCorrect: true })),
    ...wrongPicks.map((v) => ({ label: String(v), isCorrect: false })),
  ]);
  return { prompt: "Shoot perfect squares!", values };
}

function makeQuestion(cat: MathCategory, diff: Difficulty, n: number): Question {
  switch (cat) {
    case "addition":       return makeAdditionQuestion(diff, n);
    case "multiplication": return makeMultiplyQuestion(diff, n);
    case "primes":         return makePrimesQuestion(diff, n);
    case "squares":        return makeSquaresQuestion(diff, n);
  }
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function playGunshot(ctx: AudioContext) {
  try {
    const len = Math.floor(ctx.sampleRate * 0.11);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch { /* ignore */ }
}

function playBreak(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.18);
    osc.type = "square";
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch { /* ignore */ }
}

function playWrongHit(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.22);
    osc.type = "sawtooth";
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch { /* ignore */ }
}

function playMissSound(ctx: AudioContext) {
  try {
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.25 * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch { /* ignore */ }
}

function playCombo(ctx: AudioContext) {
  try {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      osc.type = "square";
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  } catch { /* ignore */ }
}

function playLoseLife(ctx: AudioContext) {
  try {
    const notes = [400, 300, 190];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.13;
      osc.frequency.setValueAtTime(freq, t);
      osc.type = "sawtooth";
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  } catch { /* ignore */ }
}

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

// Deterministic pseudo-random for consistent treeline
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}

function drawSky(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const skyH = H - TREELINE_H;
  const grad = ctx.createLinearGradient(0, 0, 0, skyH);
  grad.addColorStop(0, "#2a5ca8");
  grad.addColorStop(0.55, "#4a88cc");
  grad.addColorStop(1, "#80b8e8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, skyH);

  // Sun
  ctx.beginPath();
  ctx.arc(W * 0.83, 44, 30, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd55a";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.83, 44, 30, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffaa00";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pixel-ish clouds
  drawCloud(ctx, W * 0.14, 45, 1.1);
  drawCloud(ctx, W * 0.44, 32, 0.85);
  drawCloud(ctx, W * 0.62, 60, 0.65);
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  const blocks = [
    [0, 0, 42, 18], [14, -12, 28, 18], [-10, -7, 22, 15], [24, -6, 20, 15],
  ] as [number, number, number, number][];
  for (const [dx, dy, w, h] of blocks) {
    ctx.fillRect(x + dx * s, y + dy * s, w * s, h * s);
  }
}

function drawTreeline(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const groundY = H - TREELINE_H;
  // Ground fill
  ctx.fillStyle = "#1e3a10";
  ctx.fillRect(0, groundY + 20, W, TREELINE_H - 20);
  // Grass strip
  ctx.fillStyle = "#2e5a18";
  ctx.fillRect(0, groundY + 10, W, 14);

  const rng = lcg(0xdeadbeef);
  const treeCount = Math.ceil(W / 18);
  for (let i = 0; i < treeCount; i++) {
    const baseX = (i * (W / treeCount)) + (rng() - 0.5) * 28;
    const treeH = 28 + rng() * 52;
    const treeW = 18 + rng() * 22;
    const shade = rng();
    const baseY = groundY + 12;
    ctx.fillStyle = shade < 0.33 ? "#122808" : shade < 0.66 ? "#1a380e" : "#203812";
    ctx.beginPath();
    ctx.moveTo(baseX, baseY - treeH);
    ctx.lineTo(baseX - treeW / 2, baseY);
    ctx.lineTo(baseX + treeW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPigeon(ctx: CanvasRenderingContext2D, p: PigeonState, now: number) {
  if (p.status === "escaped" || p.status === "pending") return;

  const PW = 54;
  const PH = 24;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (p.status !== "flying" && p.hitTime !== null) {
    const elapsed = (now - p.hitTime) / 600;
    if (elapsed >= 1) { ctx.restore(); return; }
    ctx.rotate(elapsed * 10);
    const sc = 1 - elapsed;
    ctx.scale(sc, sc);
    ctx.globalAlpha = 1 - elapsed * 0.5;
  }

  // Glow
  if (p.status === "hit-correct") {
    ctx.shadowColor = "#22dd55";
    ctx.shadowBlur = 18;
  } else if (p.status === "hit-wrong") {
    ctx.shadowColor = "#ee2200";
    ctx.shadowBlur = 18;
  }

  // Body
  ctx.beginPath();
  ctx.ellipse(0, 0, PW / 2, PH / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle =
    p.status === "hit-correct" ? "#22aa44" :
    p.status === "hit-wrong"   ? "#cc3311" :
    "#c05818";
  ctx.fill();
  ctx.strokeStyle =
    p.status === "hit-correct" ? "#116622" :
    p.status === "hit-wrong"   ? "#881100" :
    "#7a3808";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rim line
  ctx.beginPath();
  ctx.ellipse(0, 0, PW / 2 - 5, PH / 2 - 4, 0, 0, Math.PI * 2);
  ctx.strokeStyle =
    p.status === "flying" ? "#e07030" :
    p.status === "hit-correct" ? "#33cc66" : "#dd4422";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const len = p.label.length;
  ctx.font = `bold ${len > 4 ? 7 : len > 2 ? 9 : 11}px "Press Start 2P", monospace`;
  ctx.fillText(p.label, 0, 1);

  ctx.restore();
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: ShotEffect, now: number) {
  const t = (now - effect.createdAt) / effect.duration;
  if (t >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.translate(effect.x, effect.y);

  if (effect.kind === "correct") {
    const r = 18 + t * 38;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#00ee44";
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 4;
      const d = 12 + t * 28;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#aaff66";
      ctx.fill();
    }
  } else if (effect.kind === "wrong") {
    ctx.strokeStyle = "#ff2200";
    ctx.lineWidth = 4;
    const s = 14 + t * 8;
    ctx.beginPath();
    ctx.moveTo(-s, -s); ctx.lineTo(s, s);
    ctx.moveTo(s, -s);  ctx.lineTo(-s, s);
    ctx.stroke();
  } else {
    // miss puff
    const r = 4 + t * 14;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#bbbbbb";
    ctx.fill();
  }
  ctx.restore();
}

function drawStaticScene(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky(ctx, canvas.width, canvas.height);
  drawTreeline(ctx, canvas.width, canvas.height);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DuckHunt() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pidRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loopRef = useRef<MutableLoop>({
    pigeons: [],
    effects: [],
    shotsLeft: 3,
    score: 0,
    lives: 3,
    combo: 0,
    roundStartTime: 0,
    lastFrameTime: 0,
    hitCorrect: 0,
    hitWrong: 0,
    totalCorrect: 0,
    roundOver: false,
    category: "addition",
    difficulty: "medium",
  });

  const [phase, setPhase] = useState<GamePhase>("title");
  const [category, setCategory] = useState<MathCategory>("addition");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [livesDisplay, setLivesDisplay] = useState(3);
  const [comboDisplay, setComboDisplay] = useState(0);
  const [shotsDisplay, setShotsDisplay] = useState(3);
  const [prompt, setPrompt] = useState("");
  const [countdownNum, setCountdownNum] = useState(3);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [highScores, setHighScores] = useState<HighScore[]>([]);

  // Keep refs in sync with state for use inside the game loop / callbacks
  const phaseRef = useRef<GamePhase>("title");
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Menus ─────────────────────────────────────────────────────────────────

  const dhMenus = useMemo<MenuBarMenu[]>(() => [
    { label: "Game", items: [{ label: "New Game", onClick: () => setPhase("title") }] },
  ], []);

  useWindowMenus(dhMenus);

  // ── High scores ────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setHighScores(JSON.parse(raw) as HighScore[]);
    } catch { /* ignore */ }
  }, []);

  const highScoresRef = useRef<HighScore[]>([]);
  useEffect(() => { highScoresRef.current = highScores; }, [highScores]);

  function saveScore(finalScore: number, cat: MathCategory, diff: Difficulty) {
    const entry: HighScore = {
      score: finalScore,
      category: cat,
      difficulty: diff,
      date: new Date().toLocaleDateString(),
    };
    const updated = [...highScoresRef.current, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setHighScores(updated);
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  // ── Audio ──────────────────────────────────────────────────────────────────

  function ensureAudio(): AudioContext | null {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { return null; }
    }
    return audioCtxRef.current;
  }

  // ── Canvas: static background when not playing ─────────────────────────────

  useEffect(() => {
    if (phase !== "playing") {
      const canvas = canvasRef.current;
      if (canvas) drawStaticScene(canvas);
    }
  }, [phase]);

  // ── Responsive canvas: match container width, taller on portrait ───────────

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function updateCanvasSize() {
      const w = container!.offsetWidth || CW;
      const portrait = window.innerHeight > window.innerWidth;
      // Portrait: ~75% of viewport height minus chrome; landscape: classic 2:1
      const maxH = portrait
        ? Math.round(Math.min(window.innerHeight * 0.72, w * 1.35))
        : Math.round(w * 0.5);
      const h = Math.max(maxH, 160);
      canvas!.width = w;
      canvas!.height = h;
      if (phaseRef.current !== "playing") {
        drawStaticScene(canvas!);
      }
    }

    const obs = new ResizeObserver(updateCanvasSize);
    obs.observe(container);
    updateCanvasSize();
    return () => obs.disconnect();
  }, []); // run once after mount

  // ── Game loop ──────────────────────────────────────────────────────────────

  const checkRoundEndRef = useRef<() => void>(() => {});

  const drawFrame = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    drawSky(ctx, W, H);
    drawTreeline(ctx, W, H);
    const loop = loopRef.current;
    for (const p of loop.pigeons) drawPigeon(ctx, p, now);
    for (const e of loop.effects) drawEffect(ctx, e, now);
  }, []);

  function stopLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function startLoop() {
    stopLoop();
    const loop = loopRef.current;
    loop.lastFrameTime = performance.now();

    function frame(now: number) {
      const dt = Math.min((now - loop.lastFrameTime) / 1000, 0.05);
      loop.lastFrameTime = now;

      const grav = DIFF_CONFIG[loop.difficulty].gravity;
      const elapsed = now - loop.roundStartTime;
      const W = canvasRef.current?.width ?? CW;
      const H = canvasRef.current?.height ?? CH;

      for (const p of loop.pigeons) {
        if (p.status === "pending") {
          if (elapsed >= p.launchDelay) {
            p.status = "flying";
            p.x = p.launchX;
            p.y = p.launchY;
          }
          continue;
        }
        if (p.status !== "flying") continue;
        p.vy += grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > H + 60 || p.x < -100 || p.x > W + 100) {
          p.status = "escaped";
        }
      }

      loop.effects = loop.effects.filter((e) => now - e.createdAt < e.duration);

      drawFrame(now);

      const anyActive = loop.pigeons.some(
        (p) => p.status === "flying" || p.status === "pending"
      );
      if (!anyActive || loop.shotsLeft <= 0) {
        checkRoundEndRef.current();
      }

      if (!loop.roundOver && phaseRef.current === "playing") {
        rafRef.current = requestAnimationFrame(frame);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }

  function checkRoundEnd() {
    const loop = loopRef.current;
    if (loop.roundOver) return;

    const anyActive = loop.pigeons.some(
      (p) => p.status === "flying" || p.status === "pending"
    );
    if (anyActive && loop.shotsLeft > 0) return;

    loop.roundOver = true;
    stopLoop();

    const gotAll = loop.hitCorrect === loop.totalCorrect && loop.hitCorrect > 0;
    const gotAtLeastOne = loop.hitCorrect > 0;
    const newCombo = gotAll ? loop.combo + 1 : 0;
    const multiplier = 1 + newCombo * 0.5;
    const delta = loop.hitCorrect * 100 - loop.hitWrong * 25 + (gotAll ? 50 : 0);
    const finalDelta = Math.round(delta * multiplier);
    const newScore = Math.max(0, loop.score + finalDelta);
    const lostLife = !gotAtLeastOne;
    const newLives = lostLife ? loop.lives - 1 : loop.lives;

    // Play sound
    const audio = ensureAudio();
    if (audio) {
      if (gotAll && newCombo > 0) playCombo(audio);
      else if (lostLife) playLoseLife(audio);
    }

    // Update loop ref
    loop.score = newScore;
    loop.lives = newLives;
    loop.combo = newCombo;

    // Sync to React
    setScoreDisplay(newScore);
    setLivesDisplay(newLives);
    setComboDisplay(newCombo);
    setRoundResult({
      hitCorrect: loop.hitCorrect,
      totalCorrect: loop.totalCorrect,
      hitWrong: loop.hitWrong,
      gotAll,
      gotAtLeastOne,
      pointsDelta: finalDelta,
      lostLife,
    });

    if (newLives <= 0) {
      saveScore(newScore, loop.category, loop.difficulty);
      setTimeout(() => setPhase("game-over"), 600);
    } else {
      setTimeout(() => setPhase("round-result"), 600);
    }
  }

  // Keep checkRoundEndRef current
  useEffect(() => { checkRoundEndRef.current = checkRoundEnd; });

  // ── Round launch ───────────────────────────────────────────────────────────

  const pendingQuestionRef = useRef<Question | null>(null);

  function launchRound(cat: MathCategory, diff: Difficulty) {
    const cfg = DIFF_CONFIG[diff];
    // Use the pre-generated question (set during countdown) so the player already knows the prompt
    const question = pendingQuestionRef.current ?? makeQuestion(cat, diff, cfg.numPigeons);

    const loop = loopRef.current;
    loop.category = cat;
    loop.difficulty = diff;
    loop.roundOver = false;
    loop.hitCorrect = 0;
    loop.hitWrong = 0;
    loop.totalCorrect = question.values.filter((v) => v.isCorrect).length;
    loop.shotsLeft = cfg.numShots;
    loop.roundStartTime = performance.now();
    setShotsDisplay(cfg.numShots);

    const canvas = canvasRef.current;
    const W = canvas ? canvas.width : CW;
    const H = canvas ? canvas.height : CH;
    // Launch from bottom corners, alternating left/right
    const launchY = H - TREELINE_H + 10;
    const leftX = Math.round(W * 0.05);
    const rightX = Math.round(W * 0.95);
    const STAGGER_MS = 260;

    loop.pigeons = question.values.map((v, i) => {
      const fromLeft = i % 2 === 0;
      const lx = fromLeft ? leftX : rightX;
      // Steep upward arc from each corner toward the opposite side
      // fromLeft: angle ~55-70° (upper-right); fromRight: ~110-125° (upper-left)
      const baseAngleDeg = fromLeft ? 62 : 118;
      const jitter = (Math.random() - 0.5) * 18; // ±9°
      const angle = ((baseAngleDeg + jitter) * Math.PI) / 180;
      const speed = cfg.launchSpeed * (0.9 + Math.random() * 0.2);
      return {
        id: pidRef.current++,
        label: v.label,
        isCorrect: v.isCorrect,
        x: lx,
        y: launchY,
        vx: Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        status: "pending" as const,
        hitTime: null,
        radius: 34,
        launchDelay: i * STAGGER_MS,
        launchX: lx,
        launchY: launchY,
      };
    });

    loop.effects = [];
    startLoop();
    setPhase("playing");
  }

  // ── Countdown ─────────────────────────────────────────────────────────────

  function startCountdown(cat: MathCategory, diff: Difficulty) {
    // Generate the question NOW so the prompt is visible during the countdown
    const cfg = DIFF_CONFIG[diff];
    const question = makeQuestion(cat, diff, cfg.numPigeons);
    pendingQuestionRef.current = question;
    setPrompt(question.prompt);
    setPhase("countdown");
    setCountdownNum(3);
    let n = 3;
    function tick() {
      n--;
      if (n > 0) {
        setCountdownNum(n);
        countdownTimerRef.current = setTimeout(tick, 700);
      } else {
        setCountdownNum(0); // "GO!"
        countdownTimerRef.current = setTimeout(() => launchRound(cat, diff), 600);
      }
    }
    countdownTimerRef.current = setTimeout(tick, 700);
  }

  // ── Canvas click (shooting) ────────────────────────────────────────────────

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (phase !== "playing") return;
    const loop = loopRef.current;
    if (loop.shotsLeft <= 0 || loop.roundOver) return;

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    loop.shotsLeft--;
    setShotsDisplay(loop.shotsLeft);

    const audio = ensureAudio();
    if (audio) playGunshot(audio);

    // Find closest flying pigeon within hit radius
    let closest: PigeonState | null = null;
    let closestDist = Infinity;
    for (const p of loop.pigeons) {
      if (p.status !== "flying") continue; // skip pending, hit, escaped
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= p.radius && dist < closestDist) {
        closest = p;
        closestDist = dist;
      }
    }

    const now = performance.now();
    if (closest) {
      if (closest.isCorrect) {
        closest.status = "hit-correct";
        closest.hitTime = now;
        loop.hitCorrect++;
        const elapsed = (now - loop.roundStartTime) / 1000;
        const speedBonus = Math.max(0, Math.round(50 - elapsed * 12));
        loop.score += 100 + speedBonus;
        setScoreDisplay(loop.score);
        loop.effects.push({ x: closest.x, y: closest.y, createdAt: now, duration: 650, kind: "correct" });
        if (audio) playBreak(audio);
      } else {
        closest.status = "hit-wrong";
        closest.hitTime = now;
        loop.hitWrong++;
        loop.score = Math.max(0, loop.score - 25);
        setScoreDisplay(loop.score);
        loop.effects.push({ x: closest.x, y: closest.y, createdAt: now, duration: 650, kind: "wrong" });
        if (audio) playWrongHit(audio);
      }
    } else {
      loop.effects.push({ x: cx, y: cy, createdAt: now, duration: 450, kind: "miss" });
      if (audio) playMissSound(audio);
    }
  }

  // ── Phase handlers ─────────────────────────────────────────────────────────

  function handleStartGame() {
    const audio = ensureAudio();
    if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    setPhase("category-select");
  }

  function handleCategorySelect(cat: MathCategory) {
    setCategory(cat);
    setPhase("difficulty-select");
  }

  function handleDifficultySelect(diff: Difficulty) {
    setDifficulty(diff);
    const loop = loopRef.current;
    loop.score = 0;
    loop.lives = 3;
    loop.combo = 0;
    loop.category = cat_ref.current;
    setScoreDisplay(0);
    setLivesDisplay(3);
    setComboDisplay(0);
    startCountdown(cat_ref.current, diff);
  }

  // We need the current category in handleDifficultySelect without stale closure
  const cat_ref = useRef<MathCategory>("addition");
  useEffect(() => { cat_ref.current = category; }, [category]);

  function handleContinue() {
    const loop = loopRef.current;
    setRoundResult(null);
    startCountdown(loop.category, loop.difficulty);
  }

  function handlePlayAgain() {
    stopLoop();
    setRoundResult(null);
    setPrompt("");
    setPhase("title");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLoop();
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderHearts(n: number) {
    return Array.from({ length: 3 }, (_, i) => (
      <span key={i} className={`dh-heart${i < n ? "" : " dh-heart--lost"}`}>♥</span>
    ));
  }

  function renderShots(n: number, total: number) {
    return Array.from({ length: total }, (_, i) => (
      <span key={i} className={`dh-shot${i < n ? "" : " dh-shot--used"}`}>●</span>
    ));
  }

  const totalShots = DIFF_CONFIG[difficulty].numShots;

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="dh-game">
      {/* Canvas — always rendered, overlaid with phase UI */}
      <div className="dh-canvas-wrap" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className={`dh-canvas${phase === "playing" ? " dh-canvas--active" : ""}`}
          onClick={handleCanvasClick}
        />

        {/* Phase overlays */}
        {phase === "title" && (
          <div className="dh-overlay">
            <div className="dh-panel dh-panel--title">
              <div className="dh-title-icon">🎯</div>
              <h1 className="dh-title">Duck &amp; Learn</h1>
              <p className="dh-subtitle">Shoot the right answers!</p>
              <div className="dh-divider" />
              {highScores.length > 0 && (
                <div className="dh-hi-scores">
                  <div className="dh-hi-scores__label">HIGH SCORES</div>
                  {highScores.slice(0, 3).map((hs, i) => (
                    <div key={i} className="dh-hi-scores__row">
                      <span>{i + 1}.</span>
                      <span>{hs.score}</span>
                      <span>{CATEGORY_LABELS[hs.category]}</span>
                      <span>{DIFF_CONFIG[hs.difficulty].label}</span>
                    </div>
                  ))}
                </div>
              )}
              <button className="dh-btn dh-btn--primary" onClick={handleStartGame}>
                ▶ Start Game
              </button>
            </div>
          </div>
        )}

        {phase === "category-select" && (
          <div className="dh-overlay">
            <div className="dh-panel">
              <h2 className="dh-panel__title">Choose Category</h2>
              <div className="dh-btn-grid">
                {(["addition", "multiplication", "primes", "squares"] as MathCategory[]).map((cat) => (
                  <button
                    key={cat}
                    className="dh-btn dh-btn--option"
                    onClick={() => handleCategorySelect(cat)}
                  >
                    {cat === "addition"       && <span>➕</span>}
                    {cat === "multiplication" && <span>✖️</span>}
                    {cat === "primes"         && <span>🔢</span>}
                    {cat === "squares"        && <span>⬛</span>}
                    <span>{CATEGORY_LABELS[cat]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === "difficulty-select" && (
          <div className="dh-overlay">
            <div className="dh-panel">
              <h2 className="dh-panel__title">Shooting Difficulty</h2>
              <p className="dh-panel__sub">Category: {CATEGORY_LABELS[category]}</p>
              <div className="dh-diff-list">
                {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => {
                  const cfg = DIFF_CONFIG[diff];
                  return (
                    <button
                      key={diff}
                      className="dh-btn dh-btn--diff"
                      onClick={() => handleDifficultySelect(diff)}
                    >
                      <span className="dh-btn__label">{cfg.label}</span>
                      <span className="dh-btn__detail">
                        {cfg.numPigeons} pigeons · {cfg.numShots} shots · {diff === "easy" ? "slow" : diff === "medium" ? "medium" : "fast"} speed
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === "countdown" && (
          <div className="dh-overlay dh-overlay--transparent">
            <div className="dh-countdown-wrap">
              <div className="dh-countdown-prompt">{prompt}</div>
              <div className="dh-countdown">
                {countdownNum > 0 ? countdownNum : "GO!"}
              </div>
            </div>
          </div>
        )}

        {phase === "round-result" && roundResult && (
          <div className="dh-overlay dh-overlay--transparent">
            <div className="dh-result-panel">
              {roundResult.gotAtLeastOne ? (
                <>
                  <div className="dh-result-icon">
                    {roundResult.gotAll ? "🎯" : "✅"}
                  </div>
                  <div className="dh-result-main">
                    {roundResult.gotAll ? "PERFECT!" : "HIT!"}
                  </div>
                  {roundResult.gotAll && comboDisplay > 1 && (
                    <div className="dh-result-combo">COMBO x{comboDisplay}</div>
                  )}
                  <div className={`dh-result-pts${roundResult.pointsDelta >= 0 ? " dh-result-pts--pos" : " dh-result-pts--neg"}`}>
                    {roundResult.pointsDelta >= 0 ? "+" : ""}{roundResult.pointsDelta} pts
                  </div>
                </>
              ) : (
                <>
                  <div className="dh-result-icon">💀</div>
                  <div className="dh-result-main dh-result-main--bad">MISS!</div>
                  <div className="dh-result-sub">Life lost</div>
                </>
              )}
              <button className="dh-btn dh-btn--continue" onClick={handleContinue}>
                Continue ▶
              </button>
            </div>
          </div>
        )}

        {phase === "game-over" && (
          <div className="dh-overlay">
            <div className="dh-panel dh-panel--gameover">
              <div className="dh-go-icon">💀</div>
              <h2 className="dh-panel__title">GAME OVER</h2>
              <div className="dh-go-score">
                <span>Final Score</span>
                <span className="dh-go-score__val">{scoreDisplay}</span>
              </div>
              {highScores.length > 0 && (
                <div className="dh-hi-scores">
                  <div className="dh-hi-scores__label">TOP SCORES</div>
                  {highScores.slice(0, 5).map((hs, i) => (
                    <div key={i} className={`dh-hi-scores__row${hs.score === scoreDisplay && i === 0 ? " dh-hi-scores__row--new" : ""}`}>
                      <span>{i + 1}.</span>
                      <span>{hs.score}</span>
                      <span>{CATEGORY_LABELS[hs.category]}</span>
                      <span>{DIFF_CONFIG[hs.difficulty].label}</span>
                    </div>
                  ))}
                </div>
              )}
              <button className="dh-btn dh-btn--primary" onClick={handlePlayAgain}>
                ▶ Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HUD bar — visible during gameplay phases */}
      {(phase === "playing" || phase === "countdown" || phase === "round-result") && (
        <div className="dh-hud">
          <div className="dh-hud__left">
            <span className="dh-hud__label">SCORE</span>
            <span className="dh-hud__val">{scoreDisplay}</span>
            {comboDisplay > 1 && (
              <span className="dh-hud__combo">x{comboDisplay}</span>
            )}
          </div>
          <div className="dh-hud__center">
            <span className="dh-hud__prompt">{prompt}</span>
          </div>
          <div className="dh-hud__right">
            <div className="dh-hud__lives">{renderHearts(livesDisplay)}</div>
            <div className="dh-hud__shots">{renderShots(shotsDisplay, totalShots)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
