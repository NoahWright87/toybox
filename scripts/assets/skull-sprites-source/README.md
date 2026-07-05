# Skull enemy sprite sheets (source)

Mad-Max-style vehicle sprite sheets, ChatGPT-generated and supplied
directly by Noah (not downloaded) for the Shmup Editor's built-in enemy
sprites. Referred to as "skull" enemies (not "Mad Max") throughout the
codebase — every derived filename is prefixed `skull-`.

Each sheet is a 1254x1254 PNG, a 4x4 grid of frames: row 0 = idle, row 1 =
moving, row 2 = attacking, row 3 = dying (4 frames per state). The
"transparent" checkerboard visible in each sheet is **baked into opaque
pixels**, not real alpha — `scripts/prepare-skull-sprites.mjs` flood-fills
real transparency back in when extracting the built-in sprite (see that
script's header comment).

Kept here (not under `public/`) as the source for that script to re-run
against — not served to the app directly.

| File | SHA-256 | Vehicle |
|---|---|---|
| `skull-buggy-sheet.png` | `955045b6240bb090b60b342b4774f2891bfb21c4343ffcee41916f303531e170` | Spiked dune buggy |
| `skull-technical-sheet.png` | `0a43d804a543126d37f777b5bdbed26efd1de7d00585ace1cea854aa39a5d544` | Gunner "technical" truck |
| `skull-motorcycle-sheet.png` | `2052337849b9f2b745edef92809871504d80a6f858ea9eda5df5eb53d258d9eb` | Motorcycle rider |
| `skull-helicopter-sheet.png` | `b045a17ecd7426ffcc05b50558e2719e000902cdda927c204a7dbb2b89a2e140` | Gunship helicopter |

Only the idle frame (row 0, col 0) of each sheet is used today, extracted
into `public/shmup-editor/enemies/skull-*.png` — see that folder's
README.md. The other 15 frames per sheet are unused for now (deferred
animation-preview work, see `specs/shmup-editor.todo.md`).
