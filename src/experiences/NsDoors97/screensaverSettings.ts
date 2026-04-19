export type ScreensaverId =
  | "starfield"
  | "fireworks"
  | "bouncing-shapes"
  | "scrolling-text"
  | "bouncing-polygons"
  | "raining-emojis";

export interface StarfieldSettings {
  speed: number;      // 1–30
  starCount: number;  // 100–1000
}

export interface FireworksSettings {
  particlesPerBurst: number; // 20–120
  burstRate: number;         // bursts per minute 5–120
}

export interface BouncingShapesSettings {
  shapeCount: number; // 3–30
  speed: number;      // 1–10
}

export interface ScrollingTextSettings {
  textMode: "datetime" | "catchphrase" | "custom";
  customText: string;
  speed: number;      // 1–10
  color: string;
  fontSize: number;   // 16–80
}

export interface BouncingPolygonsSettings {
  count: number;       // 1–20
  vertices: number;    // 3–8
  speed: number;       // 1–10
  rounded: boolean;
  trailLength: number; // 0–60
}

export interface RainingEmojisSettings {
  density: number;         // 10–150
  speedMultiplier: number; // 1–10
  customEmojis: string;    // comma-separated
  minSize: number;         // 10–100
  maxSize: number;         // 10–100
}

export interface AllScreensaverSettings {
  starfield: StarfieldSettings;
  fireworks: FireworksSettings;
  "bouncing-shapes": BouncingShapesSettings;
  "scrolling-text": ScrollingTextSettings;
  "bouncing-polygons": BouncingPolygonsSettings;
  "raining-emojis": RainingEmojisSettings;
}

export const DEFAULT_SETTINGS: AllScreensaverSettings = {
  starfield: { speed: 4, starCount: 500 },
  fireworks: { particlesPerBurst: 60, burstRate: 30 },
  "bouncing-shapes": { shapeCount: 15, speed: 3 },
  "scrolling-text": { textMode: "catchphrase", customText: "", speed: 4, color: "#ff9a44", fontSize: 40 },
  "bouncing-polygons": { count: 3, vertices: 4, speed: 3, rounded: false, trailLength: 20 },
  "raining-emojis": { density: 40, speedMultiplier: 3, customEmojis: "", minSize: 14, maxSize: 60 },
};

export interface FullScreensaverConfig {
  screensaver: ScreensaverId | null;
  waitMinutes: number; // 0 = disabled
  settings: AllScreensaverSettings;
}

const LS_KEY = "ns-screensaver-config";

export function loadScreensaverConfig(): FullScreensaverConfig {
  const dflt: FullScreensaverConfig = {
    screensaver: null,
    waitMinutes: 1,
    settings: { ...DEFAULT_SETTINGS },
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return dflt;
    const p = JSON.parse(raw) as Partial<FullScreensaverConfig & { settings: Partial<AllScreensaverSettings> }>;
    return {
      screensaver: p.screensaver ?? null,
      waitMinutes: p.waitMinutes ?? 1,
      settings: {
        starfield: { ...DEFAULT_SETTINGS.starfield, ...(p.settings?.starfield ?? {}) },
        fireworks: { ...DEFAULT_SETTINGS.fireworks, ...(p.settings?.fireworks ?? {}) },
        "bouncing-shapes": { ...DEFAULT_SETTINGS["bouncing-shapes"], ...(p.settings?.["bouncing-shapes"] ?? {}) },
        "scrolling-text": { ...DEFAULT_SETTINGS["scrolling-text"], ...(p.settings?.["scrolling-text"] ?? {}) },
        "bouncing-polygons": { ...DEFAULT_SETTINGS["bouncing-polygons"], ...(p.settings?.["bouncing-polygons"] ?? {}) },
        "raining-emojis": { ...DEFAULT_SETTINGS["raining-emojis"], ...(p.settings?.["raining-emojis"] ?? {}) },
      },
    };
  } catch {
    return dflt;
  }
}

export function saveScreensaverConfig(config: FullScreensaverConfig): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {}
}
