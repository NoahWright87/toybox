# Projectile sprite sheet (raw source)

`projectiles-sheet.png` — a 73-icon contact sheet of placeholder
projectile art (small-arms bullets, rockets, bombs/mines, fire/energy
orbs, sci-fi canisters), Noah-supplied directly (ChatGPT-generated,
1254x1254 PNG, no alpha, magenta chroma-keyed background), originally
staged at `public/shmup-editor/projectiles/projectiles.png`.

| File | SHA-256 |
|---|---|
| `projectiles-sheet.png` | `9448ab8bbf1ae796531c77afeb5b3abff1957ef6b027c4f6f86432b68a21c8b6` |

`../prepare-projectiles.mjs` extracts a curated 20-icon subset (see
`public/shmup-editor/projectiles/README.md` for the processed output
list) rather than all 73, so the Unit picker gets a useful, visually
distinct set instead of a wall of near-duplicates.
