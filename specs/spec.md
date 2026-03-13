# Spec Template — Current State

## Purpose

A two-product system for spec-driven development: an installable scaffold that gives AI a persistent memory in any repo, and an optional autonomous worker container that runs the intake/TODO workflow on a schedule.

## Related

- [`scaffold.md`](scaffold.md) — Layer 1 current state (scaffold files, dist/ generation)
- [`worker.md`](worker.md) — Layer 2 current state (worker container, modes, CI/CD)
- [`scaffold.todo.md`](scaffold.todo.md) — future scaffold and dist/ work
- [`worker.todo.md`](worker.todo.md) — future worker runtime work
- [`spec.todo.md`](spec.todo.md) — meta-tooling improvements (commands, UX)

## System Overview

The system has two independent layers. A repo can use Layer 1 without ever running Layer 2.

**Layer 1 — Installable scaffold:** a small set of files (spec templates, AI slash commands, a PR check workflow) that downstream repos copy in via `/respec` or from `dist/`. Gives AI a persistent spec memory in the target repo. See [`scaffold.md`](scaffold.md).

**Layer 2 — Autonomous worker:** a Docker container that clones a target repo, detects whether the scaffold is installed, and either bootstraps it (install mode) or runs the intake/TODO workflow (operate mode) on a cron schedule. See [`worker.md`](worker.md).

## Commands

- `/what-now`: Thin interactive entrypoint — presents a menu via AskUserQuestion and delegates to the chosen command by reading and following that command file. Lazy-loads only the selected command; no other files enter context. Intended for supervised use; the worker and autonomous agents use `specs/AGENTS.md` directly.
  - `intake` (Steps 1–8): Ensure INTAKE.md exists → check waiting/snoozed items → pull from GitHub Issues → read `auto_create_issues` config from `specs/.meta.json` (controls whether manual submissions later get auto-filed as GH issues; absent = asks user) → read Submissions → survey TODO spec files → process each item (route/boost/ask) → selectively clear INTAKE.md → report
    - **Auto-create GH issues:** opt-in via `"auto_create_issues": true` in `specs/.meta.json`; if the key is absent, asks the user. When enabled and `gh` is authenticated, creates a GH issue for each unlinked manual submission and labels it `intake:filed`. Off by default.
  - `refine` (Steps 1–6): Find highest-priority TODO items → re-check waiting items for new GH responses → load GH issue + spec context → assess clarity and estimate effort → write technical detail and estimates → commit and open PR
    - **Effort estimates:** XS / S / M / L / XL / Unknown (with optional `?` uncertainty markers) — added inline as `*(effort: M?)*` on the TODO item
    - **Supervised mode:** iterates with user in chat until sign-off, then commits and opens PR
    - **Headless mode:** posts clarifying questions to GH issues for unresolved product decisions, adds best-effort technical detail, commits and opens PR automatically; picks up GH replies on the next run
  - `knock-out-todos`: Implement the easiest open TODO items — picks well-understood, low-risk work and executes it
  - `spec-backfill`: Generate spec files from an existing codebase
  - `respec`: Install or update the spec system in a target repo

## Scripts

- `scripts/generate-dist.sh` — regenerates `dist/` from scaffold source files; run after modifying any scaffold source
- `scripts/install-scaffold.sh <target>` — copies `dist/` scaffold files into a target repo without overwriting existing files; faster/cheaper alternative to running `/respec` with Claude for the deterministic file-copy step
- `scripts/generate-roadmap.sh` — generates `docs/ROADMAP.md` from all `specs/**/*.todo.md` files; groups open items by area with links back to individual spec files; suitable for GH Pages publishing
- `.github/workflows/pages.yml` — publishes `docs/` and `specs/` to GitHub Pages on push to main; regenerates roadmap before upload

## Human-Facing Docs

- `README.md` is the human entrypoint; Quick Start (onboarding command) appears first before any background explanation
- AI-facing instructions live in `.claude/commands/` and `specs/AGENTS.md` — not in the README

## Guarantees / Constraints

- Scaffold files in `dist/` are auto-generated from source — edit sources, run `scripts/generate-dist.sh`, commit result
- Worker supports two auth modes: Claude Code subscription (mount `~/.claude`) or Anthropic API key (`ANTHROPIC_API_KEY`); never bake credentials into the image
- Worker state volume is a supporting cache; GitHub and the target repo are the primary system of record
