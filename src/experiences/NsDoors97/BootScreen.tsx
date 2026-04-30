import { useState, useEffect, useCallback, useRef } from "react";
import { randomDelay, chunkIncrement, makeSleep } from "../../utils/retroTiming";
import logoUrl from "./doors97-logo.png";
import "./BootScreen.css";

// ── localStorage helpers ───────────────────────────────────────────────────

const BOOT_KEY = "ns_doors_last_boot";
const BOOT_COOLDOWN = 30 * 60 * 1000; // 30 minutes

export function shouldShowBoot(): boolean {
  try {
    const raw = localStorage.getItem(BOOT_KEY);
    if (!raw) return true;
    const ts = parseInt(raw, 10);
    return isNaN(ts) || Date.now() - ts > BOOT_COOLDOWN;
  } catch {
    return false;
  }
}

function markBooted(): void {
  try {
    localStorage.setItem(BOOT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

// ── Random content ─────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CPUS = [
  "Noahsoft Turbocore 9000 — 233MHz",
  "NXP Munchmaster Pro — 166MHz",
  "Generic Brand CPU — 133MHz (Patent Pending)",
  "AMD K6-2 — 266MHz (Slightly Overcooked)",
  "Intel Celeryon 300A (Turbo NOT Enabled)",
  "Cyrix 6x86 PR200+ — Just Trust Us",
  "IDT WinChip 2 — 200MHz (Smells Like Burning)",
  "Noahsoft Hexacore Jr. — 450MHz (Theoretical)",
];

const DRIVES = [
  "NOAHSOFT HDD — 540MB [ULTRA-SLOW MODE]",
  "MAXHARDISK QX — 1.2GB [LBA ENABLED]",
  "QUANTUM FIREBALL — 810MB [WARRANTY VOID]",
  "TOSHIBA CD-ROM 4X [ATAPI] [DUSTY]",
  "MITSUMI CD-ROM — ONLY READS AOL DISCS",
  "IOMEGA ZIP 100 — CLICK OF DOOM DETECTED",
  "SEAGATE MEDALIST — 2.1GB [LOUD]",
  "GENERIC CD-RW — BURNS AT 1X OUT OF SPITE",
];

const IRQS = [
  "Assigned to keyboard",
  "Assigned to mouse",
  "Assigned to unknown device",
  "Free but haunted",
  "Reserved (do not disturb)",
  "Assigned to your feelings",
  "Conflicted (aren't we all)",
  "Claimed by a device that no longer exists",
];

const USB_STATUS = [
  "2 ports found (neither working reliably)",
  "No USB found — as expected",
  "USB found but it is basically decoration",
  "3 ports detected, 1 owned by a mystery device",
  "USB 1.1 — enjoy your 12 Mbps",
];

const BIOS_QUIPS = [
  "BIOS extension loaded — warranty may already be void",
  "Running memory test... just kidding, skipping it",
  "CMOS settings OK (probably)",
  "BIOS update available: NoahBIOS v3.0 — requires 27 floppy disks",
  "Plug and Pray devices detected: 3",
  "Scanning for gremlins in memory... none found (yet)",
  "Checking hard drive... please hold... still holding...",
  "Boot sequence optimized for maximum nostalgia",
  "Verifying system integrity... integrity is vibing",
  "This BIOS has not been updated since 1997. Consider updating. (Don't.)",
  "S.M.A.R.T. status: Drive says it's fine. It always says that.",
  "Shadow RAM enabled: your secrets are safe",
  "Energy Star compliant: it uses energy, anyway",
  "Checking for Y2K issues... results inconclusive",
  "Bus speed set to 66MHz. Bus is running late.",
];

const SETUP_HINTS = [
  "DEL to enter SETUP         F8 for Boot Menu",
  "Press DEL for BIOS Setup     F12 for network boot",
  "F2 = BIOS Setup    F10 = Boot Select    ESC = Panic",
];

const TAGLINES = [
  '"A door to a world of possibilities."',
  '"Knock knock. Who\'s there? The future."',
  '"Opening doors you didn\'t know were closed."',
  '"Built for the information superhighway. And the side streets."',
  '"Because doors are better than windows.™"',
  '"We put the \'soft\' in software."',
  '"Warning: may cause excessive productivity. Or none at all."',
  '"It\'s probably going to be fine."',
  '"The operating system your mother warned you about."',
  '"Now with 47% more bits."',
  '"Certified Pre-Owned™ by Noahsoft."',
  '"Experience the journey. Don\'t ask about the destination."',
  '"Pushing the envelope. Occasionally opening it."',
  '"Where do you want to go today? (Please specify.)"',
  '"Technology for the rest of us. And also some of them."',
  '"Not responsible for lost data, time, or dignity."',
  '"Powered by dreams, caffeine, and questionable decisions."',
];

const STATUS_MESSAGES = [
  "Initializing NS Doors 97...",
  "Loading system registry...",
  "Starting virtual device drivers...",
  "Initializing memory manager...",
  "Loading display driver...",
  "Configuring system devices...",
  "Starting network services...",
  "Loading desktop shell...",
  "Almost there...",
  "NS Doors 97 ready.",
];

const BOOT_QUIPS = [
  "Negotiating with the hamsters...",
  "Untangling the internet cables...",
  "Installing unnecessary toolbars...",
  "Scanning for viruses (not finding any, feeling guilty)...",
  "Loading 47 startup programs you didn't ask for...",
  "Preparing to ask you to register this software...",
  "Buffering... buffering...",
  "Contacting Noahsoft activation servers (they're asleep)...",
  "Applying unnecessary visual effects...",
  "Parsing the registry (it's fine, don't look at it)...",
  "Counting your Recycle Bin items... empty? Really?",
  "Calibrating the cup holder driver...",
  "Locating Clippy... please wait...",
  "Defragmenting your enthusiasm...",
];

// ── Content generators ─────────────────────────────────────────────────────

interface BiosData {
  year: number;
  cpu: string;
  ramBytes: number;
  drive1: string;
  drive2: string;
  drive3: string;
  pciCount: number;
  irqNum: number;
  irqStatus: string;
  usb: string;
  quip: string;
  setupKey: string;
}

function generateBiosData(): BiosData {
  const ramMB = pick([32, 64, 128, 256]);
  return {
    year:      1997 + Math.floor(Math.random() * 3),
    cpu:       pick(CPUS),
    ramBytes:  ramMB * 1024 * 1024,
    drive1:    pick(DRIVES),
    drive2:    Math.random() > 0.35 ? pick(DRIVES) : "None",
    drive3:    Math.random() > 0.6  ? pick(DRIVES) : "None",
    pciCount:  Math.floor(Math.random() * 5) + 1,
    irqNum:    Math.floor(Math.random() * 15) + 1,
    irqStatus: pick(IRQS),
    usb:       pick(USB_STATUS),
    quip:      pick(BIOS_QUIPS),
    setupKey:  pick(SETUP_HINTS),
  };
}

interface SplashData {
  tagline: string;
  bootMessages: string[];
}

function generateSplashData(): SplashData {
  const msgs = [...STATUS_MESSAGES];
  msgs.splice(3 + Math.floor(Math.random() * 4), 0, pick(BOOT_QUIPS));
  return { tagline: pick(TAGLINES), bootMessages: msgs };
}

// ── Audio ──────────────────────────────────────────────────────────────────

export function playShutdownSound(): void {
  try {
    const ctx = new AudioContext();
    const notes = [
      { freq: 783.99, t: 0.0,  dur: 0.14 },
      { freq: 659.25, t: 0.11, dur: 0.14 },
      { freq: 523.25, t: 0.22, dur: 0.14 },
      { freq: 392.0,  t: 0.33, dur: 0.14 },
      { freq: 329.63, t: 0.44, dur: 0.14 },
      { freq: 261.63, t: 0.55, dur: 0.55 },
    ];
    notes.forEach(({ freq, t, dur }) => {
      const osc = ctx.createOscillator();
      const gn  = ctx.createGain();
      osc.connect(gn); gn.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const at = ctx.currentTime + t;
      gn.gain.setValueAtTime(0, at);
      gn.gain.linearRampToValueAtTime(0.12, at + 0.015);
      gn.gain.setValueAtTime(0.12, at + dur - 0.05);
      gn.gain.linearRampToValueAtTime(0, at + dur);
      osc.start(at); osc.stop(at + dur + 0.01);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch { /* ignore */ }
}

function playPostBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "square"; osc.frequency.value = 1000;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0.15, t + 0.09);
    gain.gain.linearRampToValueAtTime(0, t + 0.11);
    osc.start(t); osc.stop(t + 0.12);
    setTimeout(() => ctx.close(), 400);
  } catch { /* ignore */ }
}

function playStartupSound(): void {
  try {
    const ctx = new AudioContext();
    const notes = [
      { freq: 261.63, t: 0.0,  dur: 0.14 },
      { freq: 329.63, t: 0.11, dur: 0.14 },
      { freq: 392.0,  t: 0.22, dur: 0.14 },
      { freq: 523.25, t: 0.33, dur: 0.14 },
      { freq: 659.25, t: 0.44, dur: 0.14 },
      { freq: 783.99, t: 0.55, dur: 0.55 },
    ];
    notes.forEach(({ freq, t, dur }) => {
      const osc = ctx.createOscillator();
      const gn  = ctx.createGain();
      osc.connect(gn); gn.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const at = ctx.currentTime + t;
      gn.gain.setValueAtTime(0, at);
      gn.gain.linearRampToValueAtTime(0.12, at + 0.015);
      gn.gain.setValueAtTime(0.12, at + dur - 0.04);
      gn.gain.linearRampToValueAtTime(0, at + dur);
      osc.start(at); osc.stop(at + dur + 0.01);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch { /* ignore */ }
}

function playRandomBeep(): void {
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = pick([440, 660, 880, 1100, 550, 770]);
    const t   = ctx.currentTime;
    const dur = 0.05 + Math.random() * 0.09;
    gain.gain.setValueAtTime(0.13, t);
    gain.gain.setValueAtTime(0.13, t + dur - 0.01);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t); osc.stop(t + dur);
    setTimeout(() => ctx.close(), 300);
  } catch { /* ignore */ }
}

// ── BIOS animation helpers ─────────────────────────────────────────────────

type ActiveDisplay =
  | null
  | { kind: "spin";    frame: number }
  | { kind: "counter"; prefix: string; value: number; unit: string }
  | { kind: "dots";    prefix: string; count: number };

const SPIN_CHARS = ["|", "/", "-", "\\"];

async function animateCounter(
  setAct: (a: ActiveDisplay) => void,
  prefix: string,
  target: number,
  unit: string,
  sleep: (ms: number) => Promise<void>
): Promise<void> {
  let current = 0;
  setAct({ kind: "counter", prefix, value: 0, unit });
  while (current < target) {
    await sleep(randomDelay({ base: 22, variance: 0.7, panicChance: 0.01, panicMultiplier: 12 }));
    const delta = chunkIncrement({ avgChunk: target / 20, critChance: 0.08, critMultiplier: 4 });
    current = Math.min(Math.round(current + delta), target);
    setAct({ kind: "counter", prefix, value: current, unit });
  }
}

async function animateDots(
  setAct: (a: ActiveDisplay) => void,
  prefix: string,
  maxDots: number,
  sleep: (ms: number) => Promise<void>
): Promise<void> {
  for (let d = 1; d <= maxDots; d++) {
    setAct({ kind: "dots", prefix, count: d });
    await sleep(randomDelay({ base: 210, variance: 0.5, panicChance: 0.05, panicMultiplier: 7 }));
  }
}

async function animateSpin(
  setAct: (a: ActiveDisplay) => void,
  totalMs: number,
  sleep: (ms: number) => Promise<void>
): Promise<void> {
  const frameMs = 110;
  let elapsed = 0;
  let frame = 0;
  while (elapsed < totalMs) {
    setAct({ kind: "spin", frame });
    await sleep(Math.min(frameMs, totalMs - elapsed));
    elapsed += frameMs;
    frame = (frame + 1) % 4;
  }
}

// ── Component ──────────────────────────────────────────────────────────────

const SEGMENT_COUNT = 22;

interface BootScreenProps {
  onComplete: () => void;
  splashOnly?: boolean;
}

export default function BootScreen({ onComplete, splashOnly = false }: BootScreenProps) {
  const [phase, setPhase]               = useState<"bios" | "black" | "splash">(splashOnly ? "splash" : "bios");
  const [termLines, setTermLines]        = useState<string[]>([]);
  const [active, setActive]             = useState<ActiveDisplay>(null);
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashMsg, setSplashMsg]        = useState("");

  // Generate all random content once on mount
  const contentRef = useRef<{ bios: BiosData; splash: SplashData } | null>(null);
  if (!contentRef.current) {
    contentRef.current = { bios: generateBiosData(), splash: generateSplashData() };
  }

  const doneRef       = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const doComplete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    markBooted();
    onCompleteRef.current();
  }, []);

  // Backspace skips at any time
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Backspace") doComplete(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doComplete]);

  // ── Main async sequence (drives the entire boot) ─────────────────────────
  useEffect(() => {
    const cancelRef = { current: false };
    const sleep     = makeSleep(cancelRef);
    const { bios, splash } = contentRef.current!;

    const addLine = (text: string) =>
      setTermLines((prev) => [...prev, text]);

    async function runAll() {
      try {
        // ── Splash-only path (returning from NS-TOS) ──────────────────────
        if (splashOnly) {
          setSplashMsg(splash.bootMessages[0]);
          setSplashProgress(0);
          playStartupSound();

          let p = 0;
          while (p < 100) {
            await sleep(randomDelay({ base: 185, variance: 0.7, panicChance: 0.09, panicMultiplier: 6 }));
            const delta = chunkIncrement({ avgChunk: 3, critChance: 0.12, critMultiplier: 5 });
            p = Math.min(p + delta, 100);
            setSplashProgress(p);
            const msgIdx = Math.min(
              Math.floor((p / 100) * splash.bootMessages.length),
              splash.bootMessages.length - 1
            );
            setSplashMsg(splash.bootMessages[msgIdx]);
            if (Math.random() < 0.07) playRandomBeep();
          }

          await sleep(200);
          doComplete();
          return;
        }

        // ── BIOS phase ────────────────────────────────────────────────────

        await sleep(randomDelay({ base: 220, variance: 0.4 }));
        playPostBeep();
        addLine(`Noahsoft BIOS v2.6.${bios.year}  —  Copyright (C) ${bios.year} Noahsoft Corp.`);
        addLine("");

        // CPU
        await sleep(randomDelay({ base: 270, variance: 0.5 }));
        addLine(`CPU: ${bios.cpu}`);

        // RAM — count up in bytes
        await sleep(randomDelay({ base: 180, variance: 0.4 }));
        await animateCounter(setActive, "Memory: ", bios.ramBytes, " bytes", sleep);
        setActive(null);
        addLine(`Memory: ${bios.ramBytes.toLocaleString()} bytes  OK`);

        addLine("");

        // Drive detection with dots
        await sleep(randomDelay({ base: 320, variance: 0.5 }));
        await animateDots(setActive, "Primary IDE Master ", 6, sleep);
        setActive(null);
        addLine(`Primary IDE Master ...... ${bios.drive1}`);

        await sleep(randomDelay({ base: 200, variance: 0.5, panicChance: 0.06 }));
        await animateDots(setActive, "Primary IDE Slave ", 7, sleep);
        setActive(null);
        addLine(`Primary IDE Slave ....... ${bios.drive2}`);

        await sleep(randomDelay({ base: 160, variance: 0.5 }));
        await animateDots(setActive, "Secondary IDE Master ", 4, sleep);
        setActive(null);
        addLine(`Secondary IDE Master .... ${bios.drive3}`);

        addLine("");

        // PCI scan with dots
        await sleep(randomDelay({ base: 210, variance: 0.5 }));
        await animateDots(setActive, "PCI Bus scan ", 5, sleep);
        setActive(null);
        addLine(`PCI Bus: ${bios.pciCount} device(s) found`);

        // IRQ + USB
        await sleep(randomDelay({ base: 200, variance: 0.5, panicChance: 0.06 }));
        addLine(`IRQ${bios.irqNum}: ${bios.irqStatus}`);

        await sleep(randomDelay({ base: 180, variance: 0.5 }));
        addLine(`USB: ${bios.usb}`);

        addLine("");

        // ── Spooky long wait + quip ──
        const spinMs = randomDelay({
          base: 750, variance: 0.5, panicChance: 0.15, panicMultiplier: 7,
        });
        await animateSpin(setActive, spinMs, sleep);
        setActive(null);
        addLine(bios.quip);

        addLine("");

        // Random abrupt beep (40%)
        if (Math.random() < 0.4) {
          await sleep(randomDelay({ base: 140, variance: 0.4 }));
          playRandomBeep();
        }

        // SETUP keys + skip hint
        await sleep(randomDelay({ base: 220, variance: 0.4 }));
        addLine(bios.setupKey);

        await sleep(randomDelay({ base: 160, variance: 0.4 }));
        addLine("[Press Backspace to skip]");

        // Final pause — let the user read / panic
        await sleep(randomDelay({ base: 1600, variance: 0.3, panicChance: 0.1, panicMultiplier: 3 }));

        // ── Black screen (abrupt screen clear) ───────────────────────────
        setPhase("black");
        await sleep(550);

        // ── Splash phase (abrupt appearance) ─────────────────────────────
        setPhase("splash");
        setSplashMsg(splash.bootMessages[0]);
        setSplashProgress(0);
        playStartupSound();

        let p = 0;
        while (p < 100) {
          await sleep(randomDelay({ base: 185, variance: 0.7, panicChance: 0.09, panicMultiplier: 6 }));
          const delta = chunkIncrement({ avgChunk: 3, critChance: 0.12, critMultiplier: 5 });
          p = Math.min(p + delta, 100);
          setSplashProgress(p);
          const msgIdx = Math.min(
            Math.floor((p / 100) * splash.bootMessages.length),
            splash.bootMessages.length - 1
          );
          setSplashMsg(splash.bootMessages[msgIdx]);
          // Random extra beep (7% per step)
          if (Math.random() < 0.07) playRandomBeep();
        }

        // Brief hold at 100% then cut to desktop — no fade
        await sleep(200);
        doComplete();

      } catch {
        // Cancelled (backspace skip or unmount)
      }
    }

    runAll();
    return () => { cancelRef.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────

  const filledSegments = Math.round((splashProgress / 100) * SEGMENT_COUNT);

  return (
    <div className="boot-overlay">

      {/* ── BIOS terminal ── */}
      {phase === "bios" && (
        <div className="boot-bios">
          {termLines.map((line, i) => {
            if (line === "")          return <div key={i} className="boot-bios__spacer" />;
            if (line.startsWith("[")) return <div key={i} className="boot-bios__skip">{line}</div>;
            if (i === 0)              return <div key={i} className="boot-bios__header">{line}</div>;
            return <div key={i} className="boot-bios__line">{line}</div>;
          })}

          {/* Active element / cursor */}
          {active?.kind === "counter" && (
            <div className="boot-bios__line">
              {active.prefix}{active.value.toLocaleString()}{active.unit}
              <span className="boot-bios__cursor" aria-hidden />
            </div>
          )}
          {active?.kind === "dots" && (
            <div className="boot-bios__line">
              {active.prefix}{".".repeat(active.count)}
              <span className="boot-bios__cursor" aria-hidden />
            </div>
          )}
          {active?.kind === "spin" && (
            <div className="boot-bios__cursor-line">
              <span className="boot-bios__spin-char" aria-hidden>
                {SPIN_CHARS[active.frame % 4]}
              </span>
            </div>
          )}
          {active === null && (
            <div className="boot-bios__cursor-line">
              <span className="boot-bios__cursor" aria-hidden />
            </div>
          )}
        </div>
      )}

      {/* phase === "black": just the overlay background — nothing rendered */}

      {/* ── Splash screen (abrupt, no fade) ── */}
      {phase === "splash" && (
        <div className="boot-splash">
          <div className="boot-splash__top">
            <img
              src={logoUrl}
              alt="NS Doors 97"
              className="boot-splash__logo-img"
              draggable={false}
            />
            <div className="boot-splash__tagline">{contentRef.current?.splash.tagline}</div>
          </div>

          <div className="boot-splash__bottom">
            <div
              className="boot-splash__bar"
              role="progressbar"
              aria-valuenow={Math.round(splashProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
                <div
                  key={i}
                  className={`boot-splash__segment${i < filledSegments ? " boot-splash__segment--on" : ""}`}
                />
              ))}
            </div>
            <div className="boot-splash__status">{splashMsg}</div>
          </div>

          <div className="boot-splash__skip">Backspace to skip</div>
        </div>
      )}

    </div>
  );
}
