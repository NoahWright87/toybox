# Hellzone — Developer Guide

## Core design constraint: audio-off playability

Hell is designed for mobile-first play. Players are frequently in public with volume off. This is a **hard requirement**, not a nice-to-have:

> **Every piece of information conveyed by audio must also be conveyed by a visual or on-screen text cue.**

Specifically:
- Any enemy telegraph before a big attack (charge, special move, explosion) needs both an audio cue AND a visible on-screen tell — an animation, a status effect, a subtitle, or ideally all three.
- Warning sounds (low health alarm, danger music, incoming projectile) need visual equivalents.
- Player voice lines (wolf quips) are nice-to-have audio; they already have subtitles by default.

If you add a new mechanic that relies on audio for timing or information, **add a visual equivalent before shipping**.

## Subtitle system

All on-screen text uses `showMessage(text, category, _audio?)` in `Hellzone.tsx`.

### Subtitle categories

| Category | Color | Toggleable? | Use for |
|---|---|---|---|
| `'info'` | bright yellow | no | System feedback: pickup notifications, key found, tutorial, cheat codes |
| `'player'` | warm gold | yes | Wolf's voice: quips, reactions, commentary |
| `'monster_tell'` | bright red | **never** | Enemy attack telegraphs — critical for audio-off players |
| `'monster_voice'` | orange | yes | Enemy ambient vocalizations, taunts, banter |

`monster_tell` **must always be shown**. It is the subtitle equivalent of a visual tell and cannot be disabled. If an enemy has a charged/telegraphed attack, the subtitle fires at the moment the telegraph begins — same timing as the audio cue.

Player settings live in `subtitleSettings: SubtitleSettings` inside the useEffect closure. Toggle UI to be added to the Options/Pause menu.

### showMessage API

```typescript
showMessage(text: string, category: SubtitleCategory = 'info', _audio?: string)
```

- `category` controls color and whether it respects the subtitle toggle
- `_audio` is reserved for recorded voice clips; wire the path now even if the file doesn't exist yet
- Use `fireQuip(key)` for wolf quips — it picks randomly, passes category='player', and handles the audio field
- Use `softFireQuip(key)` for door/ambient quips that should skip if the cooldown is busy
- Use `queueQuip(key, weaponKey?)` for combat quips that should wait for a post-fight lull

## Quip system

All user-facing character text lives in `quips.ts`. Do **not** hardcode quip strings in `Hellzone.tsx`.

The lull queue:
- Combat quips (`queueQuip`) are held in a queue until ~1.5 s passes with no kills or damage.
- When the lull is detected and the global cooldown has cleared, one quip fires and the queue clears.
- This prevents quip spam mid-fight and creates the "sigh of relief" moment after clearing a room.

Immediate quips (`fireQuip`):
- Pickups, weapon acquisition, no-ammo, death, level clear — these fire immediately.
- They still set the global cooldown so they don't stack.

### Adding a new quip type

1. Add the key to the `QuipKey` union in `quips.ts`
2. Add the text lines under `QUIPS` using the `lines()` helper
3. Decide the `SubtitleCategory` for the call site
4. Call `fireQuip`, `softFireQuip`, or `queueQuip` at the right moment in `Hellzone.tsx`

### Adding audio later

Each `Quip` has `{ text: string; audio?: string }`. When a clip is recorded:
1. Drop the file in `/public/audio/hellzone/` using the naming convention below
2. Fill in the `audio` field on that specific entry in `quips.ts`
3. `showMessage` already accepts and will play the audio path (wired but stubbed now)

#### Naming convention for audio files

```
/public/audio/hellzone/{speaker}-{slug}.mp3

wolf-down-kitty.mp3
wolf-low-health.mp3
cat-charge-tell.mp3
```

Use `{speaker}-{short-description}.mp3`. Keep slugs short and lowercase with hyphens.

## Enemy attack tells — checklist

When adding a new enemy type or special attack, confirm:

- [ ] Audio cue plays at the start of the telegraph
- [ ] Visible animation or sprite change signals the wind-up
- [ ] `showMessage(text, 'monster_tell')` fires with a short description ("CAT CHARGING!", "WATCH OUT!")
- [ ] The visual feedback is readable at 320×180 (the raycaster canvas resolution)

## Architecture notes

- The raycaster renders at 320×180 and is scaled up by CSS. All canvas text and sprite sizes should be tuned for that native resolution.
- `Hellzone.tsx` is a single large useEffect that owns all game state as closure variables. New state belongs in that closure, not as React state (React re-renders would break the game loop).
- Sounds are loaded once in the `AudioContext` setup block; add new sound IDs to the `loadSounds` call alongside existing ones.
- `quips.ts` is plain TypeScript with no React dependency — keep it that way.
