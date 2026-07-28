// ---------------------------------------------------------------------------
// Pure theme-token data — NO filesystem imports, so seed.ts / FileSystemStore
// can import THEME_INI without a circular dependency.
//
// Maps friendly theme.ini keys to the CSS custom properties defined in
// src/theme.css. Defaults here MUST match the :root values in src/theme.css.
// ---------------------------------------------------------------------------

export interface ThemeToken {
  /** Key as it appears in theme.ini under [Theme] */
  iniKey: string;
  /** The CSS custom property it drives (without leading --) */
  cssVar: string;
  /** Human label for the Design app */
  label: string;
  /** Default value — must mirror src/theme.css :root */
  default: string;
}

export const THEME_TOKENS: ThemeToken[] = [
  { iniKey: "OrangePrimary", cssVar: "orange-primary",  label: "Orange (primary)", default: "#cc4400" },
  { iniKey: "OrangeBright",  cssVar: "orange-bright",   label: "Orange (bright)",  default: "#ff6b00" },
  { iniKey: "Purple",        cssVar: "purple",          label: "Purple",           default: "#5b2d8e" },
  { iniKey: "PurpleBright",  cssVar: "purple-bright",   label: "Purple (bright)",  default: "#7b3dbe" },
  { iniKey: "GreenWin",      cssVar: "green-win",       label: "Green (win)",      default: "#228833" },
  { iniKey: "Win95Gray",     cssVar: "win95-gray",      label: "Win95 gray",       default: "#c0c0c0" },
  { iniKey: "Win95WarmGray", cssVar: "win95-warm-gray", label: "Win95 warm gray",  default: "#d4d0c8" },
  { iniKey: "Win95Dark",     cssVar: "win95-dark",      label: "Win95 dark",       default: "#808080" },
];

export type ThemeValues = Record<string, string>; // cssVar -> value

export const DEFAULT_THEME: ThemeValues = Object.fromEntries(
  THEME_TOKENS.map((t) => [t.cssVar, t.default]),
);

/** Default theme.ini file contents — seeded for new installs (and migrate). */
export const THEME_INI = `; theme.ini — NS Doors 97 color scheme
; Edit these hex values (in Notebook or the Design app) and the whole
; desktop re-skins instantly. Delete a line to fall back to the default.
[Theme]
${THEME_TOKENS.map((t) => `${t.iniKey}=${t.default}`).join("\n")}
`;
