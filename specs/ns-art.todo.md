# NS Art — TODO

Planned improvements, in rough priority order. Each section describes the target behavior after implementation; move completed items to `ns-art.md`.

---

## 1. Strip panel: frame filmstrip preview

**Current state:** Strip tabs are text-only.

**Target:** Each strip tab is taller and contains a row of small frame thumbnail images. The thumbnails are rendered from the actual `ImageData` stored in `framesDataRef`. The active frame in the active strip is highlighted (e.g. orange border). Thumbnails are fixed-height (e.g. 40 px tall, proportional width), and the tab scrolls horizontally if there are many frames. Clicking a thumbnail switches to that strip + frame. The strip name appears as a small text label above the filmstrip row.

---

## 2. Zoom: replace tool with +/− controls

**Current state:** Zoom is a tool in the toolbox. Clicking cycles 1×→2×→4×→1×; broken on mobile.

**Target:**
- Remove the Zoom tool from the toolbox entirely.
- Add `−` and `+` buttons in the status bar below the canvas (or directly below the canvas area).
- Supported levels: **1×, 2×, 4×, 8×, 16×**.
- Buttons disable at the min/max levels.
- Current zoom level is displayed between the two buttons (e.g. `4×`).
- The canvas area centers the zoomed canvas and scrolls if it overflows.

---

## 3. Pixel grid overlay

**Current state:** Grid menu item exists but does nothing.

**Target:**
- **View > Pixel Grid** (or Format > Pixel Grid) toggles the grid on/off. Persists in component state.
- When zoom is 4× or higher, the grid is eligible to display (if toggled on).
- When zoom is below 4×, the grid is hidden regardless of toggle state.
- The grid is a CSS overlay on the canvas wrapper — it does **not** draw into the canvas pixel data.
- Grid lines are 1 CSS px, semi-transparent dark (e.g. `rgba(0,0,0,0.3)`), spaced exactly `zoom` pixels apart to align with canvas pixels.

---

## 4. Pencil/brush: one tool, hard pixels, shape toggle

**Current state:** Two separate tools (Pencil, Brush) both use `lineCap: "round"` with anti-aliasing. Produces blurry/dithered output.

**Target:**
- Merge into a single **Brush** tool.
- **Square stamp mode:** each stroke plots hard-edged filled squares (use `fillRect` per pixel step along the path, Bresenham line between pointer events). No anti-aliasing.
- **Round stamp mode:** same Bresenham approach but stamp a circular mask instead of a square.
- A small shape toggle (□ / ○) appears below the tool palette or in a tool-options row, active only when Brush is selected.
- Brush size options: **1 px, 3 px, 5 px, 8 px** (replace the current 2/5/10 sizes). At 1 px, square and round are identical.
- Right-click draws with the secondary color.

---

## 5. Eraser: hard-edge, clears to transparent

**Current state:** Eraser uses `lineCap: "round"` which produces anti-aliased semi-transparent pixels at stroke edges.

**Target:**
- Eraser uses the same Bresenham stamp approach as the Brush (step 4) but writes fully transparent pixels via `clearRect` (or `destination-out` with a hard-edged square/circle stamp with no feathering).
- No semi-transparent pixels at the eraser edge.
- Erased areas show the checkerboard (transparent), not white.

---

## 6. Canvas size: default 100×100, quick presets + custom dialog

**Current state:** Four fixed presets (160×120, 320×240, 640×480, 800×600). Default is largest that fits.

**Target:**
- Default canvas size on first launch (no backup): **100×100**.
- **Format > Canvas Size** opens a dialog with:
  - Quick-pick presets: 64×64, 100×100, 128×128, 200×200, 320×240
  - Width and Height number inputs for a custom size
  - OK / Cancel buttons
- On OK: if the new size differs from current, warn that the canvas content will be cleared (same confirmation pattern as New).
- Remove the old preset-only auto-size-on-mount logic.

---

## 7. Rectangle: sharp corners, optional round-corner toggle

**Current state:** `strokeRect` produces rectangles with slightly rounded corners due to `lineJoin` defaults.

**Target:**
- Rect tool draws with `lineJoin: "miter"` and `lineCap: "butt"` so corners are pixel-sharp.
- Optionally, a Round Corners checkbox in the tool options row enables `lineJoin: "round"` for users who want it.
- This toggle is only visible when the Rect tool is active.

---

## 8. Shapes and line: crisp outlines, Shift-constrain

**Current state:** Line and shape strokes are anti-aliased by the canvas 2D API. No Shift constraint.

**Target:**
- **Line tool:** draw with `imageSmoothingEnabled = false` and translate the canvas context by 0.5 px when `lineWidth` is 1 to land on pixel centers. For widths > 1 use Bresenham or accept canvas rendering — primary fix is the 0.5-px offset that eliminates the most visible blurring on horizontal/vertical lines.
- **Rect / Oval outlines:** same 0.5 px offset trick; set `lineJoin: "miter"` for Rect.
- **Shift-constrain:**
  - While drawing a Line with Shift held: snap endpoint to the nearest 45° angle.
  - While drawing a Rect with Shift held: force width = height (square).
  - Preview updates in real-time as Shift is held/released.

---

## 9. Selection tool: box select, move, delete

**Current state:** No selection tool exists.

**Target:**
- New **Select** tool (rectangle marquee, classic marching-ants border).
- Click-drag to draw a selection rectangle.
- **Move:** drag inside the selection to move the selected pixels. The vacated area becomes transparent.
- **Delete:** pressing Delete/Backspace while a selection is active clears the selected area to transparent.
- Clicking outside the selection deselects (commits the move if in progress).
- No magic wand, no freehand lasso — rectangle only for now.
- Pressing Escape cancels a move-in-progress (restores pixels to original position) and then deselects.

---

## 10. Spray can: hard pixels only

**Current state:** Spray already uses 1 px `fillRect` dots, so the scatter itself is correct. No changes needed beyond verifying no anti-aliasing occurs at the dot level.

> **TODO:** Verify whether the spray can produces any anti-aliased artifacts in practice, or whether it is already correct.

---

## Related

- `specs/ns-art.md` — current shippable behavior
- `specs/ns-doors-97.md` — parent OS context
