# Homepage — TODOs

## Sooner

- [#2](https://github.com/NoahWright87/toybox/issues/2) Implement Toy Box homepage *(effort: M)*
  - Implementation: Scaffold Vite + React + TypeScript project at repo root; add `@noahwright/design` and `react-router-dom`; render `Layout` (header/footer) wrapping a `CardGrid` of experience `Card`s; card data is a static array `{ id, title, description, category?, path }`; router handles `/` (hub) and `/{experience}` (individual toys)
  - Import design system: `npm i @noahwright/design`; import `Layout`, `Card`, `CardGrid` from `@noahwright/design` and `@noahwright/design/styles.css` for theming
  - Card grid starts with one card (Starfield); designed to scale with zero structural changes as more are added
  - Depends on: Starfield screensaver existing to link to (can scaffold with a placeholder first)

## Later

- Preserve room for "behind-the-scenes" / "director's cut" mode on individual experiences
  - No need to implement now, but avoid structural choices that make this awkward
  - Future: overlay with implementation commentary, dev notes, or debug/explanation views
- Category/tag filtering on the card grid (games, screensavers, sound toys, etc.)

## Backlog

## Reminders

- Move completed items to `spec.md` — this file is for future plans, not current state
- Items flow: INTAKE → `spec.todo.md` → `{feature}.todo.md` (if big) → `spec.md` (when done)
