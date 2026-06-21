import { fsStore } from "./filesystem/FileSystemStore";
import { THEME_INI_ID } from "./filesystem/types";
import { parseIni, updateIniSection } from "./filesystem/ini";
import { THEME_TOKENS, DEFAULT_THEME, type ThemeValues } from "./themeTokens";

// ---------------------------------------------------------------------------
// Hackable theme: the [Theme] section of C:\System\theme.ini drives the CSS
// custom properties in src/theme.css. Editing the file (via the Design app's
// color pickers OR by hand in Notebook) re-skins the whole OS live —
// applyTheme() pushes each value onto document.documentElement.
//
// Token definitions and defaults live in themeTokens.ts (no fs imports).
// ---------------------------------------------------------------------------

export type { ThemeValues } from "./themeTokens";
export { THEME_TOKENS, DEFAULT_THEME } from "./themeTokens";

function parseThemeFromIni(content: string): ThemeValues {
  const ini = parseIni(content);
  const t = ini["Theme"] ?? {};
  const out: ThemeValues = { ...DEFAULT_THEME };
  for (const tok of THEME_TOKENS) {
    const v = t[tok.iniKey];
    if (v && /^#[0-9a-fA-F]{3,8}$/.test(v.trim())) out[tok.cssVar] = v.trim();
  }
  return out;
}

export function loadThemeSettings(): ThemeValues {
  const file = fsStore.getFile(THEME_INI_ID);
  if (!file) return { ...DEFAULT_THEME };
  return parseThemeFromIni(file.content);
}

export function saveThemeSettings(values: ThemeValues): void {
  const file = fsStore.getFile(THEME_INI_ID);
  if (!file) return;
  const kvs: Record<string, string> = {};
  for (const tok of THEME_TOKENS) {
    kvs[tok.iniKey] = values[tok.cssVar] ?? tok.default;
  }
  const updated = updateIniSection(file.content, "Theme", kvs);
  fsStore.writeFile(THEME_INI_ID, updated);
}

/** Push theme values onto :root so every var(--token) updates live. */
export function applyTheme(values: ThemeValues): void {
  const root = document.documentElement;
  for (const tok of THEME_TOKENS) {
    root.style.setProperty(`--${tok.cssVar}`, values[tok.cssVar] ?? tok.default);
  }
}
