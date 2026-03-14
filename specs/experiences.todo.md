# Experiences — TODOs

## Sooner

- [#2](https://github.com/NoahWright87/toybox/issues/2) Implement Starfield screensaver — MVP first experience *(effort: S)*
  - Implementation: React component wrapping a full-viewport `<canvas>`; `requestAnimationFrame` loop; star particles as `{ x, y, z }` array where z simulates depth (smaller z = closer/faster); each frame decrement z, project to screen coords, reset particle to far depth when it passes the viewer; no external deps beyond React
  - Interaction: speed boost on click/tap (temporarily lower z delta floor); optional subtle speed slider
  - Routed at `/starfield` in the React app; card on homepage links here
  - Depends on: homepage scaffold existing (Vite + React project initialized)

## Backlog

### Stealth learning / educational

- Spelling practice game
- Custom word-list spelling toy
- Sight word game
- Typing racer
- Number Muncher clone (if not chosen for MVP)
- Prime Suspects (if not chosen for MVP)
- Factor / multiple / prime math games
- Spell Squares
- Perimeter Wizard
- Cube / volume variants

### Screensavers / visual toys

- Fireworks toy (if not chosen for MVP)
- Starfield screensaver (if not chosen for MVP)
- Maze maker / maze walker
- Fish tank screensaver
- Bouncing shapes / retro screensaver toys
- Sarcastic/inspirational quote screensaver

### Sound / music

- Controller-driven music machine
- Sound pad / musical toy

### Mini-games from inside bigger games

- Lockpicking mini-game (RPG-style)
- Fishing mini-game
- Hacking grid mini-game
- Inventory Tetris toy
- Safe cracker
- Alchemy mixer

## Reminders

- Move completed items to `spec.md` — this file is for future plans, not current state
- Stealth learning philosophy: the game is fun first; the educational content is embedded in the mechanic. Speed, repetition, and score-chasing lead to memorization "by accident." Feel rewarding first, educational second.
- Future experiences may eventually "graduate" to their own subdomain — not MVP scope
- Large or complex experiences warrant their own `{name}.todo.md` when they grow complex enough
