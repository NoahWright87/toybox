# Toybox — Roadmap

## Summary

Future work for this repo. Add projects and features here as they are planned.

## Sooner

- [#74](https://github.com/NoahWright87/toybox/issues/74) Code review by Opus — identify code quality improvements and file issues
  - Review CLAUDE.md and codebase for negative statements; suggest positive rewrites
  - Flag important rules that appear only once and would benefit from reinforcement
  - Find functionality duplicated across components (custom menu bars, window chrome, etc.)
  - Output: new GitHub issues for each finding; Opus identifies, Sonnet/Haiku cleans up

## Later

- [#8](https://github.com/NoahWright87/toybox/issues/8) Easter eggs scattered throughout the experience
  - Konami Code triggers something fun on the desktop
  - IDDQD / IDKFA cheat codes summon a visual effect (glowing Doom face, etc.)
  - `#barrelroll` URL suffix makes the page spin (à la Google)
  - Hadouken combo (down-forward + key) fires something across the screen
  - Reference Command & Conquer: Ctrl+click the speaker → surprise

## Backlog

## Ideas (Uncommitted)

## Reminders

- Move completed items to `spec.md` — this file is for future plans, not current state
- Large or complex ideas belong in their own `{feature}.todo.md`, not buried here
- Items flow: INTAKE → `spec.todo.md` → `{feature}.todo.md` (if big) → `spec.md` (when done)
- If a TODO item links to a GH issue (`[#N](...)`), include `closes #N` in your PR description — GitHub closes the issue on merge
