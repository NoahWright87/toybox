# NS Art — Spec

NS Art is a retro pixel-art paint program embedded in NS Doors 97, modeled on MS Paint from the Windows 9X era. It supports multi-strip frame animation with per-strip frame data.

## Layout

The app is arranged vertically:
1. **Strip tab bar** — tabs for each animation strip, each showing a filmstrip of frame thumbnails
2. **Main workspace** — horizontal flex: tool palette on the left, canvas area in the center, color/options panel on the right
3. **Frame navigator bar** — at the bottom: frame counter, add/remove frame buttons, playback controls, FPS field

## Strip tab bar

- Each strip tab shows the strip name (small label) above a scrollable row of 40 px-tall frame thumbnails rendered from the actual frame pixel data.
- The active frame in the active strip has an orange border on its thumbnail. Clicking any thumbnail navigates to that strip + frame.
- The active strip tab is raised; inactive tabs are slightly recessed.
- Double-clicking a tab opens an inline rename input. Confirm with Enter or blur; cancel with Escape.
- A `+` button appends a new strip. Strips can be deleted via the Animation menu.
- Tabs scroll horizontally if they overflow.

## Tool palette

Tools are arranged in a 2-column grid on the left side. Available tools:

| Tool   | Behavior |
|--------|----------|
| Brush  | Hard-edged stamps using Bresenham line between pointer events; no anti-aliasing |
| Spray  | Scatters 1 px `fillRect` dots in a circular radius; density and radius scale with brush size |
| Eraser | Same Bresenham approach as Brush but writes fully transparent pixels via `clearRect` |
| Fill   | Flood-fill from the clicked pixel |
| Line   | Click-drag preview; commits on pointer-up |
| Rect   | Click-drag preview; commits on pointer-up; outline / filled / both mode |
| Oval   | Click-drag preview using `ellipse()`; same fill modes as Rect |
| Select | Rectangle marquee; drag to select, drag inside to move, Delete to clear, Escape to cancel |

Left-click uses the primary color; right-click uses the secondary color.

Brush size options: **1 px, 3 px, 5 px, 8 px**.

**Brush/Eraser shape toggle:** □ (square stamp) or ○ (round stamp). Visible only when Brush or Eraser is active. At 1 px, square and round are identical.

**Fill mode selector** (Rect and Oval only): Outline, Filled, Both.

**Round Corners toggle** (Rect only): toggles between `miter` (sharp, pixel-exact) and `round` corners. Default is sharp.

## Canvas area

- A `<canvas>` element is CSS-scaled via `width`/`height` style to `canvasSize × zoom`.
- The canvas is initialized to solid white when first created or resized.
- Default canvas size on first launch (no backup): **100×100**.
- A transparent-pattern checkerboard is visible behind the canvas to indicate transparent areas (via CSS background on the wrapper).

### Zoom controls

- **−** and **+** buttons sit below the canvas in a zoom bar. Supported levels: **1×, 2×, 4×, 8×, 16×**. Buttons disable at min/max.
- Current zoom level is displayed between the buttons (e.g. `4×`).
- The canvas area scrolls if the zoomed canvas overflows.

### Pixel grid overlay

- **Format > Pixel Grid** toggles the grid on/off (persists in component state).
- The grid is eligible to display only when zoom is **4× or higher**; hidden at lower zoom regardless of toggle.
- Rendered as a CSS `::after` pseudo-element using `repeating-linear-gradient`; does not modify canvas pixel data.
- Grid lines are 1 CSS px, semi-transparent dark (`rgba(0,0,0,0.25)`), spaced `zoom` pixels apart.

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

- Frame counter shows `Frame N / Total`.
- Buttons: previous frame (Alt+←), next frame (Alt+→), add frame, play/stop.
- Playback button toggles looping animation at the configured FPS.
- FPS is editable via a small number input.

## Menu bar

Registered via `useWindowMenus`:

- **File** — New (clears canvas), Export Frame (PNG), Export Sprite Sheet
- **Edit** — Undo (5-level stack, `Ctrl+Z`)
- **Format** — Canvas Size… (dialog), Pixel Grid (toggle)
- **Animation** — Add Strip, Delete Strip, Rename Strip…, Onion Skin (toggle + opacity + range submenu)

### Format > Canvas Size dialog

Opens a dialog with:
- Quick-pick preset buttons: 64×64, 100×100, 128×128, 200×200, 320×240
- Width and Height number inputs for a custom size (1–2048)
- OK / Cancel buttons

On OK, if the new size differs from current and the canvas has content, warns that all frames will be cleared (same confirmation pattern as New).

## Keyboard shortcuts

| Key              | Action                                     |
|------------------|--------------------------------------------|
| Ctrl+Z           | Undo                                       |
| Alt+←            | Previous frame                             |
| Alt+→            | Next frame                                 |
| Shift (Line)     | Snap endpoint to nearest 45° angle         |
| Shift (Rect)     | Force width = height (square)              |
| Delete/Backspace | Clear selected area to transparent         |
| Escape           | Cancel selection move / deselect           |

## Drawing fidelity

- **Brush / Eraser** — Bresenham line between pointer events, hard-edged `fillRect` stamps (square) or pixel-loop circle (round). No anti-aliasing at any brush size.
- **Eraser** — writes transparent via `clearRect`; no semi-transparent edge pixels.
- **Spray** — `fillRect(…, 1, 1)` dots with `Math.round` coordinates; no anti-aliasing.
- **Line** — 0.5 px sub-pixel offset at size 1 to land strokes on pixel centres.
- **Rect** — `lineJoin: miter` + `lineCap: butt` for pixel-sharp corners by default.
- **Rect / Oval / Line** — `imageSmoothingEnabled` is not explicitly set; the 0.5 px trick and miter join handle the most visible cases.

## Selection tool

- Click-drag draws a rectangle selection with an animated marching-ants border (CSS `background-image` repeating gradient, animated).
- Drag inside the selection to move the selected pixels; the vacated area becomes transparent.
- Delete/Backspace clears the selected area to transparent and dismisses the selection.
- Clicking outside the selection commits any in-progress move and dismisses the selection.
- Escape cancels a move-in-progress (restores pixels to pre-move position) and then deselects.

## Persistence

- Auto-saves all strips and frames to `localStorage` (key `ns-art-backup`) 2 seconds after any change.
- Backup format version 2: JSON with `frameW`, `frameH`, `strips[]`, and `frames[][]` (data URLs).
- On mount, restores from backup. If the saved canvas size differs from the default, the app resizes to match before restoring.
- On close with unsaved changes, prompts: Export PNG / Close without saving / Cancel.

## Related

- `specs/ns-doors-97.md` — the parent OS that embeds NS Art in a draggable window
- `specs/ns-art.todo.md` — planned improvements
