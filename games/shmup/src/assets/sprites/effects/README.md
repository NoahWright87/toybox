# assets/sprites/effects/

Explosions, impacts, and ambient particles (stars, trails). Naming:
`fx_{name}_{state}_{frame}.png` (e.g. `fx_explosion_01.png`). Default
canvas: 64×64 — see `../../../sprites/README.md` for the full convention
guide.

`fx_bg_ground_01.png` (C5 #144) is the first real art here — a baked 4×4
sheet of ground tiles used by `sprites/groundBackground.ts` to build a
ground-episode background; see `../../../sprites/README.md`'s "Bundled art
attribution" for source/hash. Every other `effects` sprite still renders as
its manifest-declared colored placeholder primitive until a PNG lands here.
