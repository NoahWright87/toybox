# Shmup — Content & Assets Spec (TODO)

> Issue: **F2 #130** (copy registry). Status: framing locked.
>
> The sprite registry & asset pipeline (F5 #133) has shipped — see
> [`content-and-assets.spec.md`](./content-and-assets.spec.md).

## Content / copy registry ("copy is an asset")

All human-authored text is **data Noah edits**, referenced by key in code. Claude builds systems; Noah writes content.

- Lives in a dedicated dir (e.g. `games/shmup/content/`): game title / "Noahsoft presents" card, weapon/item/chassis/enemy names + descriptions, **Ratings tier names** (Nobody → … → Kevin Bacon), **sponsor/brand** names + taglines + personalities, event-node text, Season/Finale/Syndication flavor, and the **crowd-comment pool** (`audience-and-score.spec.todo.md`).
- Code references **by key** with safe fallbacks (missing key never throws; returns the key or `[missing: x]`).
- A typed accessor (e.g. `copy('announcer.graze.big')`) and TS shapes so keys are discoverable; tags are typed enums for autocomplete + typo-proofing.
- `content/README.md` explains authoring; editing a line is a one-file change, zero systems code.

## Related

- [`content-and-assets.spec.md`](./content-and-assets.spec.md) — sprite registry & asset pipeline (F5, implemented), including the future **Sprite Studio** note
