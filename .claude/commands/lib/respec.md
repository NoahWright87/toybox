# /respec

Apply or refresh the [spec-template](https://github.com/NoahWright87/spec-template) system in this repository.

This command handles three situations:
1) A fresh repo with no specs yet
2) An existing `specs/` folder that predates this template
3) A repo already running this template that needs updating.

It detects which case applies and walks you through each step.

**Non-Claude users:** This file is plain markdown. Read it and apply it in your tool of choice — the instructions are the same regardless of IDE.

For the reasoning behind how this command is written, see [PHILOSOPHY.md](https://github.com/NoahWright87/spec-template/blob/main/PHILOSOPHY.md).

---

## Step 1 — Assess the repo

Use Glob to check for `specs/` and Read to check for `specs/.meta.json`.

| What exists | Path to take |
|-------------|--------------|
| No `specs/` directory | [Fresh install](#fresh-install) |
| `specs/` exists, no `.meta.json` | [Adaptation](#adaptation) |
| `specs/` exists with `.meta.json` | [Update](#update) |

---

## Fresh install

### What to copy

Fetch the latest versions of the managed files (listed in [Managed files](#managed-files)) from the source repo and write them into this repo at the same relative paths.

The source repo URL is whatever URL you fetched this command from. It will be recorded in `specs/.meta.json`.

### What to ask the user first

Before writing the optional files below, describe what each one would add and ask the user whether to include it:

- **Root `AGENTS.md`** — offers agent instructions for the whole repo, with a section on using specs. If one already exists, offer to append a spec section to it rather than replacing it.
- **`CHANGELOG.md`** — a blank changelog template. If one already exists, leave it in place and skip this offer.

Write only what the user approves.

### After writing files

Write `specs/.meta.json` with the source repo URL, the current commit hash (fetch it from the source repo), and today's date:

```json
{
  "source": "https://github.com/YOUR_USERNAME/spec-template",
  "commit": "COMMIT_HASH",
  "date": "YYYY-MM-DD"
}
```

Users may add optional config keys to this file at any time (e.g. `"auto_create_issues": true`). Never remove or overwrite keys not listed above.

Then give the user a brief summary: which files were written, which optional files were included, and what to do next (run `/intake` or add specs).

---

## Adaptation

The repo already has a `specs/` folder, but it was not set up with this template. The goal is to meld the template's structure with what's already there — adding what's missing and proposing merges where files overlap. The user approves each change before anything is written.

### What to do

1. Read all existing files under `specs/` using Glob and Read.
2. For each managed file (see [Managed files](#managed-files)):
   - **Absent:** Show the user what the template version looks like and ask whether to add it.
   - **Present, compatible:** Show the user both versions side by side and propose a merge. The user decides what to keep.
   - **Present, serving the same purpose:** Propose replacing the existing file with the template version, showing both so the user can compare.
3. Write only what the user approves, one file at a time.
4. Once the user is satisfied, write `specs/.meta.json` (same format as above).
5. Report a summary: what changed, what was left in place, and any notes on differences found.

---

## Update

The repo is already running this template. Fetch upstream changes and apply them to the managed files.

### What to do

1. Read `specs/.meta.json` for the source URL and last-known commit.
2. Fetch the current versions of all managed files from the source URL.
3. For each managed file, compare the fetched version to the local copy:
   - **Unchanged:** Skip silently.
   - **Changed:** Show the user a summary of what changed and ask whether to apply it.
4. Apply approved updates. Leave everything else in place.
5. **Check TODO format migration.** Compare the fetched `specs/spec.todo.md` template against all local `*.todo.md` files. If the template uses a different bullet format than what the repo's TODO files currently use (e.g. the template now uses plain `- ` bullets but local files still use `- [ ]` checkboxes), tell the user what changed and offer to migrate. If the user approves, update the local TODO files to the current format, preserving all content. Apply only what the user approves.
6. Update `specs/.meta.json` with the new commit hash and today's date. Preserve all other keys exactly — do not remove or modify user-set fields such as `auto_create_issues`.
7. Report what was updated, what was skipped, and whether a TODO format migration was applied.

---

## Managed files

These are the files this command installs and keeps current. Everything else in the repo stays untouched.

| File | Purpose |
|------|---------|
| `specs/README.md` | Explains the spec system to humans |
| `specs/AGENTS.md` | Explains the spec system to agents |
| `specs/spec.md` | Template for writing a new spec |
| `specs/spec.todo.md` | Template for writing a new TODO spec |
| `specs/INTAKE.md` | Intake bucket for ideas and requests |
| `.claude/commands/what-now.md` | `/what-now` command (main entry point) |
| `.claude/commands/lib/intake.md` | `/intake` logic (invoked via `/what-now`) |
| `.claude/commands/lib/knock-out-todos.md` | `/knock-out-todos` logic (invoked via `/what-now`) |
| `.claude/commands/lib/spec-backfill.md` | `/spec-backfill` logic (invoked via `/what-now`) |
| `.claude/commands/lib/respec.md` | This command (invoked via `/what-now`) |
| `.claude/commands/lib/refine.md` | `/refine` logic (invoked via `/what-now`) |
| `.github/workflows/spec-check.yml` | PR check: warns when source changes lack spec updates |
| `specs/deps/README.md` | Explains the deps/ pattern; templates for dep specs and dep TODOs |

---

## Preferred tools

- **Glob** — discover what exists under `specs/` and `.claude/commands/`
- **Read** — examine existing files before proposing changes
- **WebFetch** — fetch managed files from the source repo using raw GitHub URLs
- **Write** and **Edit** — apply changes after the user confirms
