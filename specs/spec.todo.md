# Spec Template — Roadmap

## Summary
This repo provides two products: (1) an installable spec / intake / TODO scaffold for other repos, and (2) a reusable autonomous worker runtime that runs Claude CLI in a container. See `scaffold.todo.md` and `worker.todo.md` for the large feature work. This file tracks improvements to the template system itself (commands, UX, meta-tooling).

## Sooner

## Later

## Backlog

- Sync general-purpose improvements from work fork *(blocked: waiting for work-specific code to be stripped before sharing)*

## Ideas (Uncommitted)

- When `/respec` runs in Update mode, compare the `dist/specs/spec.todo.md` template against the local TODO files. If the format differs (e.g. checkboxes vs plain bullets), offer to migrate existing TODO items to the current format. Apply only with user approval.

## Reminders

- Move completed items to `spec.md` — this file is for future plans, not current state
- Large or complex ideas belong in their own `{feature}.todo.md`, not buried here
- Items flow: INTAKE → `spec.todo.md` → `{feature}.todo.md` (if big) → `spec.md` (when done)
- If a TODO item links to a GH issue (`[#N](...)`), include `closes #N` in your PR description — GitHub closes the issue on merge
