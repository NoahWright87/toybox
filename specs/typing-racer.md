# Typing Racer — Current State

## Purpose

A typing speed game. Type a displayed phrase as fast and accurately as possible; see your WPM and accuracy on completion.

## Location

- Route: `/typing-racer`
- Source: `src/experiences/TypingRacer/TypingRacer.tsx` + `TypingRacer.css`
- Page wrapper: `src/pages/TypingRacerPage.tsx`

## Behavior

- Displays a random phrase from a built-in list of 12 pangrams / short sentences (no backend).
- Timer starts on the first keystroke; stops when the full phrase is typed correctly.
- **Character highlighting** — correct chars turn green, incorrect chars turn red. The current target character has a white underline cursor.
- **Live stats** — WPM and accuracy update continuously while typing. A faint elapsed timer is shown.
- **Completion screen** — shows final WPM, accuracy, and time with a "Try again" button that loads a new phrase.
- Input has `spellCheck`, `autoComplete`, and `autoCapitalize` disabled; caret is hidden (visual cursor is drawn via CSS on the phrase).

## Related

- [`spec.md`](spec.md)
- [`experiences.todo.md`](experiences.todo.md)
