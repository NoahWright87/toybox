export type DesktopBgType    = "noahsoft" | "solid" | "wallpaper";
export type WallpaperPreset  = "sunset" | "arch";

export interface DesktopSettings {
  bgType:             DesktopBgType;
  solidColor:         string;
  wallpaperPreset:    WallpaperPreset | null;
  wallpaperCustomUrl: string | null; // data URL for user-uploaded images
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  bgType:             "noahsoft",
  solidColor:         "#008080",
  wallpaperPreset:    null,
  wallpaperCustomUrl: null,
};

export const NOAHSOFT_GRADIENT =
  "radial-gradient(ellipse 80% 60% at 50% 40%, #2a1000 0%, #180800 55%, #0c0400 100%)";

export function getDesktopBackground(settings: DesktopSettings): string {
  if (settings.bgType === "noahsoft") return NOAHSOFT_GRADIENT;
  if (settings.bgType === "solid")    return settings.solidColor;
  return "#000000"; // wallpaper — backgroundImage applied separately
}

const LS_KEY = "ns-desktop-settings";

export function loadDesktopSettings(): DesktopSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_DESKTOP_SETTINGS };
    const p = JSON.parse(raw) as Partial<DesktopSettings>;
    return {
      bgType:             p.bgType             ?? DEFAULT_DESKTOP_SETTINGS.bgType,
      solidColor:         p.solidColor         ?? DEFAULT_DESKTOP_SETTINGS.solidColor,
      wallpaperPreset:    p.wallpaperPreset     ?? null,
      wallpaperCustomUrl: p.wallpaperCustomUrl  ?? null,
    };
  } catch {
    return { ...DEFAULT_DESKTOP_SETTINGS };
  }
}

export function saveDesktopSettings(settings: DesktopSettings): void {
  try {
    // Don't persist large custom data URLs — they'd eat localStorage quota.
    // We keep them in React state only for the current session.
    const toSave: DesktopSettings = {
      ...settings,
      wallpaperCustomUrl: null,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(toSave));
  } catch {}
}
