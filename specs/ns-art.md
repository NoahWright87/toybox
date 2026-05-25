# NS Art — Spec

NS Art is a retro pixel-art paint program embedded in NS Doors 97, modeled on MS Paint from the Windows 9X era. It supports multi-strip frame animation with per-strip frame data.

## Layout

The app is arranged vertically:
1. **Strip tab bar** — tabs for each animation strip, plus a `+` button to add a new strip
2. **Main workspace** — horizontal flex: tool palette on the left, canvas area in the center, color/options panel on the right
3. **Frame navigator bar** — at the bottom: frame thumbnails, add/remove frame buttons, playback controls, FPS field

## Strip tab bar

- Each strip has a named tab. The active tab is raised; inactive tabs are slightly recessed.
- Double-clicking a tab opens an inline rename input.
- A `+` button appends a new strip. Strips can be deleted via the Animation menu.
- Tabs scroll horizontally if they overflow.

## Tool palette

Tools are arranged in a 2-column grid on the left side. Available tools:

| Tool    | Behavior |
|---------|----------|
| Pencil  | Draws with round `lineCap`/`lineJoin`, anti-aliased strokes via canvas 2D API |
| Brush   | Same stroke API but with a larger size |
| Spray   | Scatters 1px dots in a circular radius; density and radius scale with brush size |
| Eraser  | Clears pixels using `destination-out` composite with round lineCap |
| Fill    | Flood-fill from the clicked pixel |
| Line    | Click-drag preview; commits on pointer-up |
| Rect    | Click-drag preview; commits on pointer-up; outline / filled / both mode |
| Oval    | Click-drag preview using `ellipse()`; same fill modes as Rect |
| Zoom    | Click to cycle 1×→2×→4×→1×; right-click reverses |

Left-click uses the primary color; right-click uses the secondary color.

Brush size options: 2 px, 5 px, 10 px.

Fill mode selector (for Rect and Oval): Outline, Filled, Both.

## Canvas area

- A `<canvas>` element is scaled by CSS `transform: scale(zoom)`.
- The canvas is initialized to solid white when first created or resized.
- Canvas sizes are chosen from preset options: 160×120, 320×240, 640×480, 800×600.
- On mount, the largest preset that fits the available window area is selected.
- A transparent-pattern checkerboard is visible behind the canvas to indicate transparent areas (via CSS background on the wrapper).

## Onion skin

- When enabled, the onion canvas overlays the main canvas at reduced opacity.
- Previous frames are tinted red; subsequent frames are tinted teal.
- Configurable opacity (0.25 / 0.5 / 0.75) and frame range (1 or 2 adjacent frames).

## Color panel

- 28 fixed color swatches arranged in a 14×2 grid.
- A transparent swatch (checkerboard) is also available.
- Primary and secondary color wells display the active colors; clicking them opens the browser color picker.
- Double-clicking a swatch opens the color picker to reassign that swatch.

## Frame navigator bar

- Frames are displayed as small numbered boxes; the active frame is highlighted.
- Buttons: add frame, delete frame, previous frame, next frame.
- Playback button toggles looping animation at the configured FPS.
- FPS is editable via a small number input.

## Menu bar

Registered via `useWindowMenus`:

- **File** — New (clears canvas), Export Frame (PNG), Export Sprite Sheet
- **Edit** — Undo (5-level stack, `Ctrl+Z`)
- **Format** — Canvas Size (pick from presets), Grid (placeholder, not functional)
- **Animation** — Add Strip, Delete Strip, Onion Skin (toggle + opacity + range submenu)

## Keyboard shortcuts

| Key         | Action            |
|-------------|-------------------|
| Ctrl+Z      | Undo              |
| Alt+←       | Previous frame    |
| Alt+→       | Next frame        |

## Persistence

- Auto-saves all strips and frames to `localStorage` (key `ns-art-backup`) 2 seconds after any change.
- Backup format version 2: JSON with `frameW`, `frameH`, `strips[]`, and `frames[][]` (data URLs).
- On mount, restores from backup. If the saved canvas size differs from the current preset, the app resizes to match before restoring.
- On close with unsaved changes, prompts: Export PNG / Close without saving / Cancel.

## Related

- `specs/ns-doors-97.md` — the parent OS that embeds NS Art in a draggable window
- `specs/ns-art.todo.md` — planned improvements
