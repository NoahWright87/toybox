# Homepage — TODOs

## Sooner

## Later

- Preserve room for "behind-the-scenes" / "director's cut" mode on individual experiences *(effort: XS)*
  - No need to implement now, but avoid structural choices that make this awkward
  - Future: overlay with implementation commentary, dev notes, or debug/explanation views
  - Implementation: `?bts=1` query param toggles BTS mode; each experience page reads the param and conditionally renders an overlay
  - `Experience` data model gets an optional `btsNotes?: string` (or `btsComponent?: React.FC`) field when BTS content is first authored
  - Depends on: design system changes to provide an overlay/panel component — see `specs/deps/design.todo.md`
## Backlog

## Reminders

- Move completed items to `spec.md` — this file is for future plans, not current state
- Items flow: INTAKE → `spec.todo.md` → `{feature}.todo.md` (if big) → `spec.md` (when done)
