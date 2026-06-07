# NS Art — TODO

Planned improvements, in rough priority order. Each section describes the target behavior after implementation; move completed items to `ns-art.md`.

## Sooner

- [#81](https://github.com/NoahWright87/toybox/issues/81) Fix canvas scroll, zoom UX, and related controls
  - Cannot scroll/pan the canvas when zoomed in
  - On mobile, zoom fires on finger move rather than pinch only, causing erratic jumps
  - Should zoom toward the point you click/pinch, not the origin
  - Replace current zoom approach with explicit +/– controls at the bottom (retro-styled, like modern MS Paint)
  - At high zoom levels, show a pixel grid so each pixel boundary is visible; make the grid a menu-bar toggle
  - Brush size indicator should hide when the zoom tool is active; show current zoom level instead
  - Clicking a different zoom level button should immediately change to that zoom

- [#82](https://github.com/NoahWright87/toybox/issues/82) Limited palette mode
  - Add a menu-bar option to set palette size: 8, 16, or 32 colors
  - When a palette color is changed, re-map existing image pixels to the nearest new palette color
  - Enables saving a proper limited-palette PNG that matches the chosen palette

## Later

- [#94](https://github.com/NoahWright87/toybox/issues/94) Improve tools for pixel art
  - Combine pencil and brush into one tool (different brush shapes, same hard-pixel behavior — remove dithering)
  - Easier canvas size input: free-form width × height entry, not just presets; default ~100×100 px
  - Zoom improvements are covered by #81 above

- [#95](https://github.com/NoahWright87/toybox/issues/95) Reference image support
  - Provide a way to load a reference image alongside the canvas while drawing
  - Useful for pixel-art tracing and color-picking from a source image

## Backlog

## Related

- `specs/ns-art.md` — current shippable behavior
- `specs/ns-doors-97.md` — parent OS context
