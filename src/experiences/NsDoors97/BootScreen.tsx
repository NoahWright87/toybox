import { useState, useEffect, useCallback, useRef } from "react";
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

// ── Random content pools ───────────────────────────────────────────────────

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
];

const SETUP_HINTS = [
  "DEL to enter SETUP         F8 for Boot Menu",
  "Press DEL for BIOS Setup     F12 for network boot",
  "F2 = BIOS Setup    F10 = Boot Select    ESC = Panic",
];

function generatePostLines(): string[] {
  const year = 1997 + Math.floor(Math.random() * 3);
  const ramMB = pick([32, 64, 128, 256]);
  const drive1 = pick(DRIVES);
  const drive2 = Math.random() > 0.35 ? pick(DRIVES) : "None";
  const drive3 = Math.random() > 0.6 ? pick(DRIVES) : "None";
  const irqNum = Math.floor(Math.random() * 15) + 1;
  const pciCount = Math.floor(Math.random() * 5) + 1;

  return [
    `Noahsoft BIOS v2.6.${year}  —  Copyright (C) ${year} Noahsoft Corp.`,
    "",
    `CPU: ${pick(CPUS)}`,
    `Memory: ${ramMB * 1024}K OK`,
    "",
    `Primary IDE Master ...... ${drive1}`,
    `Primary IDE Slave ....... ${drive2}`,
    `Secondary IDE Master .... ${drive3}`,
    "",
    `PCI Bus scan: ${pciCount} device(s) found`,
    `IRQ${irqNum}: ${pick(IRQS)}`,
    `USB: ${pick(USB_STATUS)}`,
    "",
    pick(BIOS_QUIPS),
    "",
    pick(SETUP_HINTS),
    "[Press Backspace to skip]",
  ];
}

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

function generateBootMessages(): string[] {
  const msgs = [...STATUS_MESSAGES];
  const quipIdx = 3 + Math.floor(Math.random() * 4);
  msgs.splice(quipIdx, 0, pick(BOOT_QUIPS));
  return msgs;
}

// ── Audio ──────────────────────────────────────────────────────────────────

export function playShutdownSound(): void {
  try {
    const ctx = new AudioContext();
    // Descending arpeggio — mirror image of startup
    const notes = [
      { freq: 783.99, t: 0.0,  dur: 0.14 },  // G5
      { freq: 659.25, t: 0.11, dur: 0.14 },  // E5
      { freq: 523.25, t: 0.22, dur: 0.14 },  // C5
      { freq: 392.0,  t: 0.33, dur: 0.14 },  // G4
      { freq: 329.63, t: 0.44, dur: 0.14 },  // E4
      { freq: 261.63, t: 0.55, dur: 0.55 },  // C4 — hold and fade out
    ];
    notes.forEach(({ freq, t, dur }) => {
      const osc = ctx.createOscillator();
      const gn = ctx.createGain();
      osc.connect(gn);
      gn.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const at = ctx.currentTime + t;
      gn.gain.setValueAtTime(0, at);
      gn.gain.linearRampToValueAtTime(0.12, at + 0.015);
      gn.gain.setValueAtTime(0.12, at + dur - 0.05);
      gn.gain.linearRampToValueAtTime(0, at + dur);
      osc.start(at);
      osc.stop(at + dur + 0.01);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch {
    // Audio not available — ignore
  }
}

function playPostBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 1000;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0.15, t + 0.09);
    gain.gain.linearRampToValueAtTime(0, t + 0.11);
    osc.start(t);
    osc.stop(t + 0.12);
    setTimeout(() => ctx.close(), 400);
  } catch {
    // Audio not available — ignore
  }
}

function playStartupSound(): void {
  try {
    const ctx = new AudioContext();
    // Ascending arpeggio ↑ then a held chord — C major feel
    const notes = [
      { freq: 261.63, t: 0.0,  dur: 0.14 },  // C4
      { freq: 329.63, t: 0.11, dur: 0.14 },  // E4
      { freq: 392.0,  t: 0.22, dur: 0.14 },  // G4
      { freq: 523.25, t: 0.33, dur: 0.14 },  // C5
      { freq: 659.25, t: 0.44, dur: 0.14 },  // E5
      { freq: 783.99, t: 0.55, dur: 0.55 },  // G5 — hold
    ];
    notes.forEach(({ freq, t, dur }) => {
      const osc = ctx.createOscillator();
      const gn = ctx.createGain();
      osc.connect(gn);
      gn.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const at = ctx.currentTime + t;
      gn.gain.setValueAtTime(0, at);
      gn.gain.linearRampToValueAtTime(0.12, at + 0.015);
      gn.gain.setValueAtTime(0.12, at + dur - 0.04);
      gn.gain.linearRampToValueAtTime(0, at + dur);
      osc.start(at);
      osc.stop(at + dur + 0.01);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch {
    // Audio not available — ignore
  }
}

// ── Component ──────────────────────────────────────────────────────────────

const SEGMENT_COUNT = 24;

interface BootScreenProps {
  onComplete: () => void;
}

export default function BootScreen({ onComplete }: BootScreenProps) {
  const [phase, setPhase] = useState<"bios" | "logo">("bios");
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");

  const doneRef = useRef(false);
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Backspace") doComplete();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doComplete]);

  // Generate content exactly once (survives re-renders)
  const contentRef = useRef<{ postLines: string[]; bootMessages: string[] } | null>(null);
  if (!contentRef.current) {
    contentRef.current = {
      postLines: generatePostLines(),
      bootMessages: generateBootMessages(),
    };
  }

  // ── BIOS phase: reveal lines one by one ──────────────────────────────────
  useEffect(() => {
    const { postLines } = contentRef.current!;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    playPostBeep();

    let delay = 350;
    postLines.forEach((line) => {
      const d = delay;
      timers.push(
        setTimeout(() => {
          if (!cancelled) setVisibleLines((prev) => [...prev, line]);
        }, d)
      );
      // Empty lines appear instantly; text lines get a semi-random stagger
      delay += line === "" ? 40 : 55 + Math.floor(Math.random() * 95);
    });

    // After last line, pause then transition to logo
    timers.push(
      setTimeout(() => {
        if (!cancelled) setPhase("logo");
      }, delay + 950)
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Logo phase: animate progress bar ────────────────────────────────────
  useEffect(() => {
    if (phase !== "logo") return;
    const { bootMessages } = contentRef.current!;

    let cancelled = false;
    setProgress(0);
    setStatusMsg(bootMessages[0]);
    playStartupSound();

    let p = 0;
    const id = setInterval(() => {
      if (cancelled) return;
      p += 1.1 + Math.random() * 2.4;
      if (p >= 100) {
        p = 100;
        clearInterval(id);
        setProgress(100);
        setStatusMsg(bootMessages[bootMessages.length - 1]);
        setTimeout(() => {
          if (!cancelled) doComplete();
        }, 750);
      } else {
        setProgress(p);
        const msgIdx = Math.min(
          Math.floor((p / 100) * bootMessages.length),
          bootMessages.length - 1
        );
        setStatusMsg(bootMessages[msgIdx]);
      }
    }, 38);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase, doComplete]);

  const filledSegments = Math.round((progress / 100) * SEGMENT_COUNT);

  // ── BIOS terminal ────────────────────────────────────────────────────────
  if (phase === "bios") {
    return (
      <div className="boot-bios">
        {visibleLines.map((line, i) => {
          if (line === "") return <div key={i} className="boot-bios__spacer" />;
          if (line.startsWith("["))
            return <div key={i} className="boot-bios__skip">{line}</div>;
          if (i === 0)
            return <div key={i} className="boot-bios__header">{line}</div>;
          return <div key={i} className="boot-bios__line">{line}</div>;
        })}
        <span className="boot-bios__cursor" aria-hidden />
      </div>
    );
  }

  // ── Boot logo ────────────────────────────────────────────────────────────
  return (
    <div className="boot-logo">
      <div className="boot-logo__center">
        <div className="boot-logo__brand">Noahsoft</div>
        <div className="boot-logo__title">NS Doors 97</div>
        <div className="boot-logo__tagline">© 1997 Noahsoft Corporation. All rights reserved.</div>
      </div>

      <div className="boot-logo__progress-area">
        <div
          className="boot-logo__bar"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
            <div
              key={i}
              className={`boot-logo__segment${i < filledSegments ? " boot-logo__segment--on" : ""}`}
            />
          ))}
        </div>
        <div className="boot-logo__status">{statusMsg}</div>
      </div>

      <div className="boot-logo__skip-hint">Backspace to skip</div>
    </div>
  );
}
