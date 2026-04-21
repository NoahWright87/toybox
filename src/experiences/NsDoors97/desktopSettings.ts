export type DesktopBgType = "noahsoft" | "solid";

export interface DesktopSettings {
  bgType: DesktopBgType;
  solidColor: string;
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  bgType: "noahsoft",
  solidColor: "#008080",
};

export const NOAHSOFT_GRADIENT =
  "radial-gradient(ellipse 80% 60% at 50% 40%, #2a1000 0%, #180800 55%, #0c0400 100%)";

export function getDesktopBackground(settings: DesktopSettings): string {
  if (settings.bgType === "noahsoft") return NOAHSOFT_GRADIENT;
  return settings.solidColor;
}

const LS_KEY = "ns-desktop-settings";

export function loadDesktopSettings(): DesktopSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_DESKTOP_SETTINGS };
    const p = JSON.parse(raw) as Partial<DesktopSettings>;
    return {
      bgType: p.bgType ?? DEFAULT_DESKTOP_SETTINGS.bgType,
      solidColor: p.solidColor ?? DEFAULT_DESKTOP_SETTINGS.solidColor,
    };
  } catch {
    return { ...DEFAULT_DESKTOP_SETTINGS };
  }
}

export function saveDesktopSettings(settings: DesktopSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch {}
}
