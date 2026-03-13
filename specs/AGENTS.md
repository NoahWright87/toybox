# Specs — Agent Instructions

This directory uses **spec-driven development**. Specs are the source of truth; code implements them.

## Structure

- Specs live in `specs/` and mirror the source tree.
- Every directory in `specs/` includes:
  - `spec.md` — current, shippable behavior
  - `spec.todo.md` — future work and roadmap
- Additional focused specs are named `{feature}.spec.md` and follow the same structure as `spec.md`.
- Every spec includes a **Related** section linking to other spec files (not TODOs).

## Workflow

1. Start new work in `spec.todo.md`.
2. Once a TODO item is implemented, promote its description into `spec.md`.
3. Keep specs and code in sync — when behavior changes, update the spec alongside the code.

## Writing specs

- Describe behavior, not implementation
- Be explicit where ambiguity could cause bugs
- Keep specs short, readable, and skimmable
- Future or uncommitted behavior belongs in `spec.todo.md`, not `spec.md`

## Split rule

Applies to both spec files and TODO spec files.

- Split a spec when it grows past **300 lines**.
- A spec at **500 lines** must be split before further work continues.
- A single large or complex idea in `spec.todo.md` warrants its own `{feature}.todo.md` — use size thresholds as a guide, but also use judgment: if an idea has enough sub-concerns to benefit from its own space, extract it.
- A refined `{feature}.todo.md` functions as a PRD or HLD, all in-repo. When implemented, it graduates to `{feature}.spec.md`.

## Evolving conventions

The spec system grows to capture the team's actual conventions — not just the template defaults.

While writing or reviewing specs, notice repeated corrections from the user. When the same pattern is corrected twice or more, suggest adding it as a new bullet in the Writing specs section of this file (`specs/AGENTS.md`). Capture team habits where agents will actually read them.

## Incomplete specs

When a spec section cannot be determined from available context, mark it with a `> **TODO:**` placeholder:

```markdown
> **TODO:** Why does this module exist? Who depends on it?
```

This format renders visibly in GitHub, is greppable (`> \*\*TODO\*\*`), and signals clearly that the section needs attention. Fill a placeholder whenever context allows — even a partial answer is better than leaving it blank. Run `/spec-backfill` at any time to scan for remaining placeholders and check overall spec completeness.

## Dependency specs

The `specs/deps/` directory holds specs and outbound TODO files for repositories this project depends on.

- `specs/deps/{name}.spec.md` — outsider knowledge: what the dep does from our perspective, why we use it, how we interface with it, owner, known quirks. Written for routing, not integration docs.
- `specs/deps/{name}.todo.md` — outbound work items; "implementing" one means opening a GitHub issue in that repo. `/knock-out-todos` opens the downstream issue and records it as a sub-bullet on the TODO item.
- Sub-bullet format for cross-repo issues: `  - [{repo}#{N}](url)` — added by `/knock-out-todos` after opening the downstream issue.
- When all sub-bullet issues are closed, the main item is unblocked. Once validated, move it to `spec.md` and drop the sub-bullets — they are implementation history, not current state.

See [`deps/README.md`](deps/README.md) for templates.

## Comments explain why, not what

This applies to code comments, spec annotations, and inline notes throughout the codebase.

Code already says what it does. A comment that merely restates the code adds noise. A comment that explains *why* — the constraint, the history, the non-obvious reason — adds signal.

- Write `# WHY: ltrimstr removes only one char; test() handles multi-space/newline prefixes` rather than `# fix whitespace`
- Write `# WHY: credential helper is scoped to github.com to avoid leaking the token to other hosts` rather than `# scope credential helper`
- When code is self-explanatory, omit the comment — the best comment is often none at all

## Language

Write specs in the affirmative. Describe what the system does. When a constraint is necessary, pair it with the positive form — "prefer X over Y" rather than "avoid Y."

## Reminders

- `spec.md` = current state — `spec.todo.md` = future plans — `{feature}.todo.md` = elaborated plans / PRDs
- Completed items flow from todo → `spec.md` when implemented
- Large ideas flow from `spec.todo.md` → their own `{feature}.todo.md` when they need room to grow
- Write in the affirmative; pair every constraint with its positive form

---

*Installed by [spec-template](https://github.com/NoahWright87/spec-template).*
