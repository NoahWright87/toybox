import { fsStore } from "./filesystem/FileSystemStore";
import { SYSTEM_INI_ID } from "./filesystem/types";
import { parseIni, updateIniSection } from "./filesystem/ini";

export type DesktopBgType    = "noahsoft" | "solid" | "wallpaper";
export type WallpaperPreset  = "sunset" | "arch";
export type WallpaperFit     = "cover" | "contain";

export interface DesktopSettings {
  bgType:             DesktopBgType;
  solidColor:         string;
  wallpaperPreset:    WallpaperPreset | null;
  wallpaperCustomUrl: string | null; // data URL for user-uploaded images
  wallpaperFit:       WallpaperFit;
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  bgType:             "solid",
  solidColor:         "#cc4400",
  wallpaperPreset:    null,
  wallpaperCustomUrl: null,
  wallpaperFit:       "cover",
};

export const NOAHSOFT_GRADIENT =
  "radial-gradient(ellipse 80% 60% at 50% 40%, #2a1000 0%, #180800 55%, #0c0400 100%)";

export function getDesktopBackground(settings: DesktopSettings): string {
  if (settings.bgType === "noahsoft") return NOAHSOFT_GRADIENT;
  if (settings.bgType === "solid")    return settings.solidColor;
  return "#000000"; // wallpaper — backgroundImage applied separately
}

const LS_KEY = "ns-desktop-settings";

function parseDesktopFromIni(content: string): DesktopSettings {
  const ini = parseIni(content);
  const d = ini["Desktop"] ?? {};
  const bgType = (d["Background"] as DesktopBgType | undefined) ?? DEFAULT_DESKTOP_SETTINGS.bgType;
  const solidColor = d["Color"] ?? DEFAULT_DESKTOP_SETTINGS.solidColor;
  const wallpaperRaw = d["Wallpaper"] ?? "(None)";
  const wallpaperPreset: WallpaperPreset | null =
    wallpaperRaw === "sunset" || wallpaperRaw === "arch" ? wallpaperRaw : null;
  const wallpaperFit = (d["WallpaperFit"] as WallpaperFit | undefined) ?? DEFAULT_DESKTOP_SETTINGS.wallpaperFit;
  return { bgType, solidColor, wallpaperPreset, wallpaperCustomUrl: null, wallpaperFit };
}

function settingsToIniKvs(settings: DesktopSettings): Record<string, string> {
  return {
    Background:    settings.bgType,
    Color:         settings.solidColor,
    Wallpaper:     settings.wallpaperPreset ?? "(None)",
    WallpaperFit:  settings.wallpaperFit,
  };
}

export function loadDesktopSettings(): DesktopSettings {
  // If system.ini has been explicitly modified by the user, it is authoritative.
  const sysIni = fsStore.getFile(SYSTEM_INI_ID);
  if (sysIni && sysIni.modifiedAt > sysIni.createdAt) {
    return parseDesktopFromIni(sysIni.content);
  }
  // Fall back to localStorage (legacy / pre-system.ini sessions)
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_DESKTOP_SETTINGS };
    const p = JSON.parse(raw) as Partial<DesktopSettings>;
    return {
      bgType:             p.bgType             ?? DEFAULT_DESKTOP_SETTINGS.bgType,
      solidColor:         p.solidColor         ?? DEFAULT_DESKTOP_SETTINGS.solidColor,
      wallpaperPreset:    p.wallpaperPreset     ?? null,
      wallpaperCustomUrl: p.wallpaperCustomUrl  ?? null,
      wallpaperFit:       p.wallpaperFit        ?? DEFAULT_DESKTOP_SETTINGS.wallpaperFit,
    };
  } catch {
    return { ...DEFAULT_DESKTOP_SETTINGS };
  }
}

export function saveDesktopSettings(settings: DesktopSettings): void {
  // Write to system.ini so users can see and edit their settings there
  const sysIni = fsStore.getFile(SYSTEM_INI_ID);
  if (sysIni) {
    const updated = updateIniSection(sysIni.content, "Desktop", settingsToIniKvs(settings));
    fsStore.writeFile(SYSTEM_INI_ID, updated);
  }
  // Also keep localStorage for any code that hasn't migrated yet
  try {
    const toSave: DesktopSettings = { ...settings, wallpaperCustomUrl: null };
    localStorage.setItem(LS_KEY, JSON.stringify(toSave));
  } catch {}
}
