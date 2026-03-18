# Experiences — TODOs

## Sooner

## Backlog

### Stealth learning / educational

- Spelling practice game
- Custom word-list spelling toy
- Sight word game
- Typing racer *(effort: M)*
  - Display a phrase; player types it as fast as possible; show live WPM + accuracy on completion; category: `"educational"`
  - Word/phrase list baked in as a static array; no backend needed
  - Highlight current target character, color correct/incorrect keystrokes in real time
- Number Muncher clone *(effort: M?)*
  - Grid of numbers; player navigates with arrow keys and "eats" numbers matching the current rule (e.g. multiples of 3, primes); category: `"educational"`
  - Stealth learning: math fluency through grid navigation speed, not drill formatting
  - Rules cycle through a predefined set (multiples, factors, primes); difficulty increases over time?
- Prime Suspects
- Factor / multiple / prime math games
- Spell Squares
- Perimeter Wizard
- Cube / volume variants

### Screensavers / visual toys

- Fireworks toy *(effort: M)*
  - Click/tap anywhere → firework burst at cursor position; category: `"toy"`
  - Canvas + `requestAnimationFrame` loop; same file/folder architecture as Starfield
  - Particles radiate outward from click point at random angles and speeds; gravity pulls down each frame; opacity fades over ~60–80 frames
  - Support multiple simultaneous bursts (array of active bursts; remove when all particles dead)
  - Color: randomize per burst (classic multicolor) or per particle — pick whichever looks better
- Bouncing shapes / retro screensaver toys *(effort: S)*
  - Canvas; shapes (circles, squares, triangles) bounce around the viewport with velocity + wall collision; category: `"screensaver"`
  - Classic DVD-logo vibe; optional delight: track/announce corner hits
  - Configurable shape count, speed, and size via constants (no UI needed)
- Maze maker / maze walker
- Fish tank screensaver
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
