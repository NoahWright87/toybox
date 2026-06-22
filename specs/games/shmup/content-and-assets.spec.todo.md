# Shmup — Content & Assets Spec

> Issues: **F2 #130** (copy registry), **F5 #133** (sprites/pipeline). Status: framing locked.

## Content / copy registry ("copy is an asset")

All human-authored text is **data Noah edits**, referenced by key in code. Claude builds systems; Noah writes content.

- Lives in a dedicated dir (e.g. `games/shmup/content/`): game title / "Noahsoft presents" card, weapon/item/chassis/enemy names + descriptions, **Ratings tier names** (Nobody → … → Kevin Bacon), **sponsor/brand** names + taglines + personalities, event-node text, Season/Finale/Syndication flavor, and the **crowd-comment pool** (`audience-and-score.spec.todo.md`).
- Code references **by key** with safe fallbacks (missing key never throws; returns the key or `[missing: x]`).
- A typed accessor (e.g. `copy('announcer.graze.big')`) and TS shapes so keys are discoverable; tags are typed enums for autocomplete + typo-proofing.
- `content/README.md` explains authoring; editing a line is a one-file change, zero systems code.

## Sprite registry & asset pipeline

**Gameplay never blocks on art.** (Precedent: the Doors-97 `Hellzone` package already has a `sprites` module + `assetOverride.ts`.)

- Code references a sprite **key**, never a hardcoded draw call or path.
- Default render = colored **placeholder primitives** (rects/circles), color-coded by faction/type — the whole game is playable with zero art.
- A **manifest JSON** (sprite key → file path, frame count, frame duration) is the wiring layer: dropping in an art batch + updating the manifest requires **zero code changes**.
- Folder structure `assets/sprites/{ships,enemies,effects,projectiles}/`; fixed canvas sizes per category (e.g. 32×32 projectiles, 64×64 fighters, 128×128 bosses); tooling-readable naming (`enemy_drone_idle_01.png`).
- **FS-override hook:** a non-empty virtual-FS file at the matching path wins over the bundled asset (path-based), consistent with the Doors 97 asset-override vision.

## External art workflow

Noah generates batches (ChatGPT/etc.) → drops them in → updates the manifest. Consistent palette per batch, PNG with real alpha. Future: **Sprite Studio** becomes the cleanup/palette-correction + sheet-assembly pass.
