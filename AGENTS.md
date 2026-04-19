# AGENTS

Keep this repo aligned with spec-driven development. Specs are the source of truth; code implements them.

## Product direction

- Toy Box is a fake operating system experience first (NS Doors 97).
- Games and toys should launch as apps inside draggable OS windows whenever practical.
- Full-page routes can exist for development or deep-linking, but in-product UX should prioritize in-OS app windows.

## Structure

- Specs live in `specs/` and mirror the source tree.
- Every directory in `specs/` includes `spec.md` (current behavior) and `spec.todo.md` (future work).
- Additional focused specs are named `{feature}.spec.md` and follow the same structure as `spec.md`.
- Every spec includes a **Related** section with links to other spec files (not TODOs).

## Workflow

1. Start new work in `spec.todo.md`.
2. Once a TODO item is implemented, promote its description into `spec.md`.
3. Keep specs and code in sync — when behavior changes, update the spec alongside the code.

## Split rule

Applies to both spec files and TODO spec files.

- Split a spec when it grows past **300 lines**.
- A spec at **500 lines** must be split before further work continues.
- A single large or complex idea in `spec.todo.md` warrants its own `{feature}.todo.md` — the same size thresholds apply, but also use judgment: if an idea has enough sub-concerns to benefit from its own space, extract it.
- A refined `{feature}.todo.md` functions as a PRD or HLD, all in-repo. When fully implemented, it graduates to `{feature}.spec.md`.

## Evolving conventions

The spec system should grow to capture the team's real conventions, not just the template defaults.

While writing or reviewing specs, notice repeated corrections from the user. When the same pattern is corrected twice or more, suggest adding it as a new bullet in the Writing specs section of `specs/AGENTS.md`. The goal is to capture team habits where agents will actually read them.

## Language

Write specs in the affirmative. Describe what the system does. When a constraint is necessary, pair it with the positive form — "prefer X over Y" rather than "avoid Y."
