import { useState, useRef, useCallback, useEffect } from "react";
import { randomDelay, makeSleep } from "../../utils/retroTiming";
import { ModemSounds, getDialDuration, type DialType } from "./ModemSounds";
import "./DialUpApp.css";

// ── ISP list ───────────────────────────────────────────────────────────────
// successBonus: added to the 0.85 base success rate
// Funny phone numbers: too few/too many digits always fail

interface ISP {
  name: string;
  phone: string;   // display label
  digits: string;  // raw digits to dial
  bonus: number;
}

const ISPS: ISP[] = [
  { name: "AOL 3.0",           phone: "1-800-827-6364",       digits: "18008276364",          bonus:  0.05 },
  { name: "CompuServe 2000",   phone: "1-800-395-0550",       digits: "18003950550",          bonus:  0.00 },
  { name: "EarthLink",         phone: "1-800-395-8425",       digits: "18003958425",          bonus:  0.02 },
  { name: "Prodigy",           phone: "1-800-776-3449",       digits: "18007763449",          bonus: -0.05 },
  { name: "NetZero (FREE!)",   phone: "867-5309",             digits: "8675309",              bonus: -0.45 }, // Jenny — 7 digits, too short
  { name: "Noahsoft Online",   phone: "1-800-NOAHSOFT",       digits: "180066247638",         bonus: -0.50 }, // 12 digits — one too many
  { name: "Juno",              phone: "4-8-15-16-23-42",      digits: "481516234200",         bonus: -0.60 }, // The Numbers — way too many
  { name: "@Home Network",     phone: "1-NCC-1701-D",         digits: "162217013",            bonus: -0.55 }, // Enterprise — 9 digits
  { name: "WebTV",             phone: "3.14159265358979...", digits: "314159265358979323846", bonus: -1.00 }, // Pi — always fails
];

// ── Settings ────────────────────────────────────────────────────────────────

interface Settings {
  ispIdx: number;
  baudRate: string;
  dialType: DialType;
  flowControl: string;
  initString: string;
  speakerVol: string;
  errorCorrection: boolean;
  compression: boolean;
  turboBoost: boolean;
  quantumTunneling: boolean;
  y2kProtection: boolean;
}

const DEFAULTS: Settings = {
  ispIdx: 0,
  baudRate: "56K V.90",
  dialType: "touchtone",
  flowControl: "hardware",
  initString: "at_f",
  speakerVol: "low",
  errorCorrection: true,
  compression: true,
  turboBoost: false,
  quantumTunneling: false,
  y2kProtection: false,
};

const SPEED_RANGES: Record<string, [number, number]> = {
  "56K V.90":      [44000, 49333],
  "33.6K V.34":    [28800, 33600],
  "28.8K V.34":    [24000, 28800],
  "14.4K V.32bis": [12000, 14400],
  "2400 V.22bis":  [2000,  2400 ],
};

// ── Success rate ───────────────────────────────────────────────────────────

function calcSuccessRate(s: Settings, isp: ISP): number {
  let r = 0.85 + isp.bonus;

  const baudMod: Record<string, number> = {
    "56K V.90": 0, "33.6K V.34": -0.05, "28.8K V.34": -0.10,
    "14.4K V.32bis": -0.20, "2400 V.22bis": -0.50,
  };
  r += baudMod[s.baudRate] ?? 0;

  if (s.dialType === "pulse") r -= 0.15;
  if (!s.errorCorrection)     r -= 0.10;
  if (!s.compression)         r -= 0.05;
  if (s.flowControl === "software") r -= 0.05;
  if (s.flowControl === "none")     r -= 0.15;

  const initMod: Record<string, number> = {
    at_f: 0, atz: 0, safe: 0.05, aggressive: -0.15, turbo_mode: -0.20,
  };
  r += initMod[s.initString] ?? 0;

  if (s.turboBoost)       r -= 0.20;
  if (s.quantumTunneling) r  = 0;
  if (s.y2kProtection)    r -= 0.25;

  return Math.max(0, Math.min(0.95, r));
}

type FailMode = "busy" | "no-answer" | "no-carrier";

function pickFailMode(digits: string, s: Settings): FailMode {
  const len = digits.length;
  if (len < 10) return "busy";
  if (len > 11) return Math.random() < 0.5 ? "no-answer" : "no-carrier";
  if (s.quantumTunneling) return "no-carrier";
  if (s.baudRate === "2400 V.22bis") return "no-carrier";
  const r = Math.random();
  if (r < 0.30) return "busy";
  if (r < 0.60) return "no-answer";
  return "no-carrier";
}

// ── Phase ──────────────────────────────────────────────────────────────────

type Phase =
  | "idle" | "dialing" | "ringing" | "handshaking" | "training"
  | "connected" | "busy" | "no-answer" | "no-carrier";

const CONNECTING_PHASES: Phase[] = ["dialing", "ringing", "handshaking", "training"];
const FAILURE_PHASES:    Phase[] = ["busy", "no-answer", "no-carrier"];

// ── Component ──────────────────────────────────────────────────────────────

export interface DialUpAppProps {
  onConnected: () => void;
}

export default function DialUpApp({ onConnected }: DialUpAppProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [phase,    setPhase]    = useState<Phase>("idle");
  const [statusMsg, setStatus]  = useState("Ready to connect.");

  const cancelObjRef = useRef<{ current: boolean }>({ current: false });
  const soundsRef    = useRef<ModemSounds | null>(null);

  const isConnecting = CONNECTING_PHASES.includes(phase);
  const isFailure    = FAILURE_PHASES.includes(phase);

  useEffect(() => {
    return () => {
      cancelObjRef.current.current = true;
      soundsRef.current?.stop();
    };
  }, []);

  const handleConnect = useCallback(async () => {
    if (isConnecting) return;

    // Cancel any in-flight attempt
    cancelObjRef.current.current = true;
    soundsRef.current?.stop();
    soundsRef.current = null;

    // Fresh cancel signal for this attempt
    const cancelObj = { current: false };
    cancelObjRef.current = cancelObj;
    const sleep = makeSleep(cancelObj);

    const isp  = ISPS[settings.ispIdx];
    const rate = calcSuccessRate(settings, isp);
    const win  = Math.random() < rate;
    const fail: FailMode | null = win ? null : pickFailMode(isp.digits, settings);

    const volMap: Record<string, number> = {
      off: 0.10, low: 0.40, medium: 0.65, high: 0.90,
    };
    const sounds = new ModemSounds(volMap[settings.speakerVol] ?? 0.40);
    soundsRef.current = sounds;

    try {
      // ── Off-hook + dial tone ─────────────────────────────────────────────
      setPhase("dialing");
      setStatus(`Dialing ${isp.phone}...`);

      sounds.playOffHook();
      await sleep(80);
      sounds.playDialTone(0.75);
      await sleep(750);

      // ── Dial the number ──────────────────────────────────────────────────
      if (settings.dialType === "pulse") {
        sounds.playPulseDial(isp.digits);
      } else {
        sounds.playDTMF(isp.digits);
      }
      await sleep(getDialDuration(isp.digits, settings.dialType) + 220);

      // ── Busy ─────────────────────────────────────────────────────────────
      if (fail === "busy") {
        setPhase("busy");
        setStatus("Line busy. Please try again.");
        sounds.playBusy();
        await sleep(3000);
        return;
      }

      // ── Ringback ─────────────────────────────────────────────────────────
      setPhase("ringing");
      setStatus("Waiting for answer...");

      const rings = fail === "no-answer"
        ? 4 + Math.floor(Math.random() * 2)
        : Math.floor(Math.random() * 2); // 0 or 1 rings before answer

      sounds.playRingback(rings);

      if (fail === "no-answer") {
        await sleep(rings * 6000 + 800);
        setPhase("no-answer");
        setStatus("No answer. Check the phone number.");
        return;
      }

      await sleep(rings * 6000 + randomDelay({ base: 400, variance: 0.5 }));

      // ── ANSam carrier ────────────────────────────────────────────────────
      setPhase("handshaking");
      setStatus("Verifying modem protocol...");

      const ansamSec = 3.1 + Math.random() * 0.5;
      sounds.playANSam(ansamSec);
      await sleep(Math.round(ansamSec * 1000));

      // ── V.8 negotiation ──────────────────────────────────────────────────
      const negMs = randomDelay({ base: 2000, variance: 0.35, panicChance: 0.10, panicMultiplier: 2 });
      sounds.playNegotiation(negMs / 1000);
      await sleep(negMs);

      if (fail === "no-carrier" && Math.random() < 0.45) {
        setPhase("no-carrier");
        setStatus("NO CARRIER — Connection failed.");
        sounds.playNoCarrier();
        await sleep(900);
        return;
      }

      // ── Training ─────────────────────────────────────────────────────────
      setPhase("training");
      setStatus("Negotiating connection speed...");

      const trainMs = randomDelay({ base: 7000, variance: 0.35, panicChance: 0.15, panicMultiplier: 2 });
      sounds.playTraining(trainMs / 1000);
      await sleep(trainMs);

      if (fail === "no-carrier") {
        setPhase("no-carrier");
        setStatus("NO CARRIER — Connection failed.");
        sounds.playNoCarrier();
        await sleep(900);
        return;
      }

      // ── Connected! ───────────────────────────────────────────────────────
      sounds.playConnected();
      const range = SPEED_RANGES[settings.baudRate] ?? SPEED_RANGES["56K V.90"];
      const speed = Math.floor(range[0] + Math.random() * (range[1] - range[0]));
      setPhase("connected");
      setStatus(`Connected at ${speed.toLocaleString()} bps!`);

      await sleep(1800);
      onConnected();

    } catch {
      // Cancelled — component unmounted or user hit Cancel
    }
  }, [settings, isConnecting, onConnected]);

  const handleCancel = useCallback(() => {
    cancelObjRef.current.current = true;
    soundsRef.current?.stop();
    soundsRef.current = null;
    setPhase("idle");
    setStatus("Ready to connect.");
  }, []);

  const isp = ISPS[settings.ispIdx];

  const dotClass =
    isConnecting        ? "dialup__dot--working" :
    phase === "connected" ? "dialup__dot--ok"    :
    isFailure           ? "dialup__dot--error"   :
    "dialup__dot--idle";

  const btnLabel = isConnecting ? "Connecting..." : isFailure ? "Try Again" : "Connect";

  return (
    <div className="dialup">
      {/* ── Header ── */}
      <div className="dialup__header">
        <span className="dialup__header-icon">📞</span>
        <span className="dialup__header-title">Dial-Up Networking</span>
      </div>

      {/* ── Provider + phone ── */}
      <div className="dialup__section">
        <div className="dialup__row">
          <label className="dialup__label">Provider:</label>
          <select
            className="dialup__select"
            value={settings.ispIdx}
            disabled={isConnecting}
            onChange={(e) => setSettings((s) => ({ ...s, ispIdx: Number(e.target.value) }))}
          >
            {ISPS.map((isp, i) => (
              <option key={i} value={i}>{isp.name}</option>
            ))}
          </select>
        </div>
        <div className="dialup__row">
          <label className="dialup__label">Phone:</label>
          <div className="dialup__phone-display">{isp.phone}</div>
        </div>
      </div>

      {/* ── Modem settings ── */}
      <div className="dialup__section dialup__section--box">
        <div className="dialup__box-title">Modem Settings</div>

        <div className="dialup__row">
          <label className="dialup__label">Max Speed:</label>
          <select
            className="dialup__select"
            value={settings.baudRate}
            disabled={isConnecting}
            onChange={(e) => setSettings((s) => ({ ...s, baudRate: e.target.value }))}
          >
            <option>56K V.90</option>
            <option>33.6K V.34</option>
            <option>28.8K V.34</option>
            <option>14.4K V.32bis</option>
            <option>2400 V.22bis</option>
          </select>
        </div>

        <div className="dialup__row">
          <label className="dialup__label">Dial Type:</label>
          <select
            className="dialup__select"
            value={settings.dialType}
            disabled={isConnecting}
            onChange={(e) => setSettings((s) => ({ ...s, dialType: e.target.value as DialType }))}
          >
            <option value="touchtone">Touch-Tone (DTMF)</option>
            <option value="pulse">Pulse (Rotary)</option>
          </select>
        </div>

        <div className="dialup__row">
          <label className="dialup__label">Flow Control:</label>
          <select
            className="dialup__select"
            value={settings.flowControl}
            disabled={isConnecting}
            onChange={(e) => setSettings((s) => ({ ...s, flowControl: e.target.value }))}
          >
            <option value="hardware">Hardware (RTS/CTS)</option>
            <option value="software">Software (XON/XOFF)</option>
            <option value="none">None</option>
          </select>
        </div>

        <div className="dialup__row">
          <label className="dialup__label">Init String:</label>
          <select
            className="dialup__select"
            value={settings.initString}
            disabled={isConnecting}
            onChange={(e) => setSettings((s) => ({ ...s, initString: e.target.value }))}
          >
            <option value="at_f">AT&amp;F  (Factory Default)</option>
            <option value="atz">ATZ  (Reset)</option>
            <option value="safe">AT&amp;F1  (Safe Mode)</option>
            <option value="aggressive">AT&amp;F2  (Aggressive)</option>
            <option value="turbo_mode">AT^TURBO  (Turbo Mode™)</option>
          </select>
        </div>

        <div className="dialup__row">
          <label className="dialup__label">Speaker:</label>
          <select
            className="dialup__select"
            value={settings.speakerVol}
            disabled={isConnecting}
            onChange={(e) => setSettings((s) => ({ ...s, speakerVol: e.target.value }))}
          >
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="dialup__checks">
          <label className="dialup__check-label">
            <input type="checkbox" checked={settings.errorCorrection} disabled={isConnecting}
              onChange={(e) => setSettings((s) => ({ ...s, errorCorrection: e.target.checked }))} />
            Error correction (V.42)
          </label>
          <label className="dialup__check-label">
            <input type="checkbox" checked={settings.compression} disabled={isConnecting}
              onChange={(e) => setSettings((s) => ({ ...s, compression: e.target.checked }))} />
            Data compression (V.42bis)
          </label>
          <label className="dialup__check-label">
            <input type="checkbox" checked={settings.turboBoost} disabled={isConnecting}
              onChange={(e) => setSettings((s) => ({ ...s, turboBoost: e.target.checked }))} />
            Turbo Boost Mode™
          </label>
          <label className="dialup__check-label">
            <input type="checkbox" checked={settings.quantumTunneling} disabled={isConnecting}
              onChange={(e) => setSettings((s) => ({ ...s, quantumTunneling: e.target.checked }))} />
            Enable Quantum Tunneling
          </label>
          <label className="dialup__check-label">
            <input type="checkbox" checked={settings.y2kProtection} disabled={isConnecting}
              onChange={(e) => setSettings((s) => ({ ...s, y2kProtection: e.target.checked }))} />
            Y2K Protection Mode
          </label>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="dialup__statusbar">
        <span className={`dialup__dot ${dotClass}`} />
        <span className="dialup__status-text">{statusMsg}</span>
      </div>

      {/* ── Buttons ── */}
      <div className="dialup__footer">
        <button
          className="dialup__btn dialup__btn--primary"
          disabled={isConnecting}
          onClick={handleConnect}
        >
          {btnLabel}
        </button>
        {isConnecting && (
          <button className="dialup__btn" onClick={handleCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
