import { useMemo, useRef, useState } from "react";
import TitleBar from "../../components/Window/TitleBar";
import MenuBar, { type MenuBarMenu } from "../../components/MenuBar/MenuBar";
import ResizeHandles from "../../components/Window/ResizeHandles";
import { Dial } from "../../components/Dial/Dial";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import {
  THEME_TOKENS,
  DEFAULT_THEME,
  loadThemeSettings,
  saveThemeSettings,
  applyTheme,
  type ThemeValues,
} from "../NsDoors97/themeSettings";
import "../NsDoors97/OsDialog.css";
import "./DesignApp.css";

// ── Navigation ───────────────────────────────────────────────────────────────

interface NavItem { id: string; label: string }
interface NavGroup { group: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    group: "Tokens",
    items: [
      { id: "colors", label: "Colors" },
      { id: "typography", label: "Typography" },
      { id: "bevels", label: "Bevels" },
    ],
  },
  {
    group: "Window chrome",
    items: [
      { id: "titlebar", label: "Title Bar" },
      { id: "menubar", label: "Menu Bar" },
      { id: "resize", label: "Resize Handles" },
      { id: "dialog", label: "Dialog" },
      { id: "buttons", label: "Buttons" },
      { id: "dial", label: "Dial" },
    ],
  },
  {
    group: "Motion",
    items: [{ id: "animations", label: "Animations" }],
  },
];

const NOTES: Record<string, string> = {
  colors:
    "Every color in the OS comes from these eight CSS custom properties. Edit one here and the change writes to C:\\System\\theme.ini and re-skins the whole desktop live — the exact same file you can open in Notebook. The picker and the text editor are two doors to the same room.",
  typography:
    "Two faces do all the work. 'Press Start 2P' is the dense pixel font used for chrome and labels (kept at 6–12px), while a monospace stack handles longer body copy so it stays readable.",
  bevels:
    "The Win95 raised/sunken look is just a four-color border. Rather than copy the recipe into every stylesheet, four utility classes derive their colors from the palette tokens — so re-theming the grays re-bevels everything.",
  titlebar:
    "The window title bar. Shrink (▼) and Embiggen (▲) buttons are optional; toggle them with the knobs. The orange→brown gradient is the OS signature.",
  menubar:
    "A self-contained dropdown menu bar. Supports separators, ✓ checkmarks, • radio marks, and disabled items. Apps register their menus through the useWindowMenus hook rather than rendering their own bar.",
  resize:
    "Eight-direction resize handles that wrap any container ref. Drag any edge or corner of the box below. The same component powers every draggable window.",
  dialog:
    "The OS alert dialog (shown here inline). In the live OS it appears as a modal overlay via OsDialogProvider / useOsDialog.",
  buttons:
    "Gray and orange beveled buttons. The pressed state simply swaps the raised bevel for a sunken one — no separate art needed.",
  dial:
    "An FL-Studio-style rotary knob. The gesture is a vertical drag (up = more), not a circular trace. Clamped mode sweeps a fixed 270° arc between min/max; unclamped mode free-spins and only reads out the number. Right-click (or long-press) resets; click the number to type a value. Reused by the Shmup Editor.",
  animations:
    "A few representative keyframe animations. Each experience names its own (no shared duplicates), but they share the snappy, slightly mechanical CRT-era timing.",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toColorInput(v: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
}

const SAMPLE_MENUS = (disableSave: boolean): MenuBarMenu[] => [
  {
    label: "File",
    items: [
      { label: "New" },
      { label: "Open…" },
      { label: "Save", disabled: disableSave },
      { separator: true },
      { label: "Exit" },
    ],
  },
  {
    label: "View",
    items: [
      { label: "Toolbar", checked: true },
      { label: "Status Bar", checked: false },
      { separator: true },
      { label: "Large Icons", checked: true, radioGroup: "icons" },
      { label: "Small Icons", checked: false, radioGroup: "icons" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DesignApp({ onQuit }: { onQuit?: () => void }) {
  const [selected, setSelected] = useState("colors");
  const [theme, setTheme] = useState<ThemeValues>(() => loadThemeSettings());

  // Ephemeral component-arg knobs (showcase only)
  const [showShrink, setShowShrink] = useState(true);
  const [showEmbiggen, setShowEmbiggen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [disableSave, setDisableSave] = useState(true);

  // Resize demo box
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 24, y: 24, w: 220, h: 120 });

  // Dial demo values
  const [dialClamped, setDialClamped] = useState(50);
  const [dialUnclamped, setDialUnclamped] = useState(0);
  const [dialNudge, setDialNudge] = useState(4);
  const [dialPercent, setDialPercent] = useState(30);

  function setToken(cssVar: string, value: string) {
    const next = { ...theme, [cssVar]: value };
    setTheme(next);
    applyTheme(next);      // live :root update
    saveThemeSettings(next); // persist to theme.ini
  }

  function resetTheme() {
    const next = { ...DEFAULT_THEME };
    setTheme(next);
    applyTheme(next);
    saveThemeSettings(next);
  }

  const menus = useMemo<MenuBarMenu[]>(
    () => [
      { label: "File", items: [{ label: "Exit", onClick: () => onQuit?.() }] },
      { label: "Theme", items: [{ label: "Reset to defaults", onClick: resetTheme }] },
    ],
    // resetTheme is stable enough for this demo app
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onQuit],
  );
  useWindowMenus(menus);

  const currentLabel =
    NAV.flatMap((g) => g.items).find((i) => i.id === selected)?.label ?? "";

  return (
    <div className="design-app">
      {/* Left: navigation tree */}
      <nav className="design-app__nav">
        {NAV.map((group) => (
          <div key={group.group} className="design-app__nav-group">
            <div className="design-app__nav-heading">{group.group}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`design-app__nav-item${
                  selected === item.id ? " design-app__nav-item--active" : ""
                }`}
                onClick={() => setSelected(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Right: preview + knobs + notes */}
      <div className="design-app__main">
        <div className="design-app__crumb">{currentLabel}</div>

        <div className="design-app__preview">
          {selected === "colors" && (
            <div className="design-swatches">
              {THEME_TOKENS.map((tok) => (
                <label key={tok.cssVar} className="design-swatch">
                  <span
                    className="design-swatch__chip bevel-sunken"
                    style={{ background: theme[tok.cssVar] }}
                  />
                  <span className="design-swatch__meta">
                    <span className="design-swatch__label">{tok.label}</span>
                    <span className="design-swatch__var">--{tok.cssVar}</span>
                  </span>
                  <input
                    type="color"
                    className="design-swatch__picker"
                    value={toColorInput(theme[tok.cssVar])}
                    onChange={(e) => setToken(tok.cssVar, e.target.value)}
                  />
                  <input
                    type="text"
                    className="design-swatch__hex bevel-sunken"
                    value={theme[tok.cssVar]}
                    spellCheck={false}
                    onChange={(e) => setToken(tok.cssVar, e.target.value)}
                  />
                </label>
              ))}
              <button className="design-btn" onClick={resetTheme}>
                Reset to defaults
              </button>
            </div>
          )}

          {selected === "typography" && (
            <div className="design-type">
              <p className="design-type__row" style={{ fontFamily: "var(--font-ui)", fontSize: 12 }}>
                Press Start 2P · 12px
              </p>
              <p className="design-type__row" style={{ fontFamily: "var(--font-ui)", fontSize: 8 }}>
                Press Start 2P · 8px (labels)
              </p>
              <p className="design-type__row" style={{ fontFamily: "var(--font-body)", fontSize: 15 }}>
                Courier New · body copy stays readable at longer lengths.
              </p>
            </div>
          )}

          {selected === "bevels" && (
            <div className="design-bevels">
              <div className="design-bevel-tile bevel-raised">.bevel-raised</div>
              <div className="design-bevel-tile bevel-sunken">.bevel-sunken</div>
              <div className="design-bevel-tile bevel-orange-raised">.bevel-orange-raised</div>
              <div className="design-bevel-tile bevel-orange-sunken">.bevel-orange-sunken</div>
            </div>
          )}

          {selected === "titlebar" && (
            <div className="design-chrome-demo">
              <div style={{ width: 320 }}>
                <TitleBar
                  title="Sample Window"
                  icon="🎛️"
                  isMaximized={isMaximized}
                  onClose={() => {}}
                  onShrink={showShrink ? () => {} : undefined}
                  onEmbiggen={showEmbiggen ? () => setIsMaximized((m) => !m) : undefined}
                />
              </div>
              <div className="design-knobs">
                <label><input type="checkbox" checked={showShrink} onChange={(e) => setShowShrink(e.target.checked)} /> Shrink button</label>
                <label><input type="checkbox" checked={showEmbiggen} onChange={(e) => setShowEmbiggen(e.target.checked)} /> Embiggen button</label>
                <label><input type="checkbox" checked={isMaximized} onChange={(e) => setIsMaximized(e.target.checked)} /> Maximized</label>
              </div>
            </div>
          )}

          {selected === "menubar" && (
            <div className="design-chrome-demo">
              <div style={{ width: 320 }}>
                <MenuBar menus={SAMPLE_MENUS(disableSave)} />
              </div>
              <div className="design-knobs">
                <label><input type="checkbox" checked={disableSave} onChange={(e) => setDisableSave(e.target.checked)} /> Disable “Save”</label>
              </div>
            </div>
          )}

          {selected === "resize" && (
            <div className="design-resize-stage">
              <div
                ref={boxRef}
                className="design-resize-box bevel-raised"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
              >
                {Math.round(box.w)} × {Math.round(box.h)}
                <ResizeHandles
                  containerRef={boxRef}
                  minWidth={120}
                  minHeight={80}
                  onResize={(pos, size) => setBox({ x: pos.x, y: pos.y, w: size.width, h: size.height })}
                />
              </div>
            </div>
          )}

          {selected === "dialog" && (
            <div className="design-chrome-demo">
              <div className="ns-dialog" style={{ position: "static" }}>
                <div className="ns-dialog__titlebar">
                  <span className="ns-dialog__titlebar-icon">⚠️</span>
                  <span className="ns-dialog__titlebar-title">NS Doors 97</span>
                  <button className="ns-dialog__titlebar-close" aria-label="Close">✕</button>
                </div>
                <div className="ns-dialog__body">
                  <span className="ns-dialog__icon" aria-hidden>💾</span>
                  <p className="ns-dialog__message">Save changes to theme.ini?</p>
                </div>
                <div className="ns-dialog__footer">
                  <button className="ns-dialog__ok">OK</button>
                  <button className="ns-dialog__ok">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {selected === "buttons" && (
            <div className="design-buttons">
              <button className="design-btn">Gray button</button>
              <button className="design-btn design-btn--pressed">Pressed</button>
              <button className="design-btn design-btn--orange">Orange button</button>
              <button className="design-btn design-btn--orange design-btn--orange-pressed">Pressed</button>
            </div>
          )}

          {selected === "dial" && (
            <div className="design-dials">
              <Dial label="Clamped 0–100" value={dialClamped} onChange={setDialClamped} min={0} max={100} />
              <Dial label="Unclamped" value={dialUnclamped} onChange={setDialUnclamped} step={1} />
              <Dial label="Nudge buttons" value={dialNudge} onChange={setDialNudge} min={0} max={10} showNudgeButtons />
              <Dial label="Custom format" value={dialPercent} onChange={setDialPercent} min={0} max={100} formatValue={(v) => `${v}%`} />
            </div>
          )}

          {selected === "animations" && (
            <div className="design-anim">
              <div className="design-anim__tile design-anim--pulse">pulse</div>
              <div className="design-anim__tile design-anim--pop">pop</div>
              <div className="design-anim__tile design-anim--spin">spin</div>
            </div>
          )}
        </div>

        <div className="design-app__notes bevel-sunken">
          {NOTES[selected]}
        </div>
      </div>
    </div>
  );
}
