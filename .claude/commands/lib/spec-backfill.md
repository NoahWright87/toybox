# /spec-backfill

Bootstrap or improve specs that mirror the codebase. Works for greenfield repos with no specs, brownfield repos with partial coverage, and already-spec'd repos that need a completeness check.

**`$ARGUMENTS`** — optional plain-language scope or depth hint. Examples:
- *(no arguments)* — scan for gaps and incomplete specs, report, ask what to do next
- `go deep in the auth module` — read source + tests for that area and fill specs
- `just map the top level` — create top-level placeholders only, skip submodules
- `check completeness` — report placeholder counts without creating anything

Re-running this command at any time is the completeness check. It is idempotent.

For the reasoning behind this command's design, see [PHILOSOPHY.md](https://github.com/NoahWright87/spec-template/blob/main/PHILOSOPHY.md).

---

## Phase 1 — Assess the repo

Use Glob to discover:

**Source roots** — look for: `src/`, `app/`, `lib/`, `packages/*/src/`, `services/*/src/`. Note all that exist.

**Test roots** — look for: `test/`, `tests/`, `__tests__/`, `spec/` (non-spec-template), `cypress/`, `playwright/`, `e2e/`, `integration/`. Note all that exist.

**Existing specs coverage** — map what already exists under `specs/`. For each existing spec file, count occurrences of `> **TODO:**` to measure incompleteness.

If `$ARGUMENTS` names a specific module or area, note it — that area gets priority in all later phases.

---

## Phase 2 — STOP POINT: report and confirm

Present a concise summary before writing anything:

1. **Gaps** — source modules with no corresponding spec file. List: source path → proposed spec path.
2. **Incomplete specs** — existing spec files that still contain `> **TODO:**` placeholders. List: file path → placeholder count.
3. **Proposed mapping** — how `src/**` would mirror into `specs/**`.

Then ask the user:

- "Should I create placeholder specs for the [N] unmapped modules?"
- "Should I also read test files to fill in the Acceptance sections?" *(ask only if test roots were found)*
- If `$ARGUMENTS` requested a deep read: "I'll read source + tests for [area] — confirm?"

Write nothing until the user approves. If the user says "just show me the report," stop here.

---

## Phase 3 — Create placeholder specs

For each unmapped source module the user approved, create a spec file using the existing `spec.md` template. Fill any section that can be reasonably inferred from the module's name, directory, or obvious purpose. Mark every section that cannot be determined with `> **TODO:**`.

**File placement:**
- Small or simple module (few files, single clear purpose) → `specs/{module}.spec.md`
- Larger or multi-concern module → `specs/{module}/spec.md`, with optional `specs/{module}/{submodule}.spec.md` for distinct sub-concerns

**Placeholder template** (used for every created spec):

```markdown
# {Module Name} Spec

## Purpose
> **TODO:** Why does this exist? Who or what depends on it?

## Related
> **TODO:** Link to related specs once they exist.

## Contract

### Inputs
> **TODO:** What does this accept? (requests, parameters, events, config, user actions)

### Outputs
> **TODO:** What does this produce or affect? (responses, UI, side effects, persisted data)

### Guarantees / Constraints
> **TODO:** Invariants, ordering, auth expectations, performance expectations.

## Behavior
> **TODO:** Describe the happy path, alternate paths, error states, and notable edge cases.

## User Experience (UX)
> **TODO:** How do consumers (users or developers) interact with this?

## Acceptance
> **TODO:** Fill from tests. What behaviors are asserted and where?
```

Fill the Purpose section with whatever the module name and location suggest, even if brief. A partial answer is better than a placeholder that will sit forever.

---

## Phase 4 — Fill Acceptance from tests (if approved)

For each spec with a `> **TODO:**` Acceptance section:

1. Find relevant test files by path similarity (`src/foo/**` ↔ tests mentioning `foo`), import references, and naming conventions (`foo.test.ts`, `FooService.spec.ts`, etc.).
2. Prioritize test types: e2e / integration / contract first; unit tests sparingly — skip assertions about internal implementation details.
3. Translate `describe` / `it` blocks into behavioral AC bullets in the Acceptance section. Focus on observable outcomes.
4. After the ACs, note the source test file paths so the link is traceable.
5. Where tests are too thin or unclear to produce honest ACs: leave the `> **TODO:**` in place and add a note: `> **TODO:** Test coverage is sparse here — add integration tests before relying on this section.`

---

## Phase 5 — Fill from source (deep mode)

For the area named in `$ARGUMENTS`:

1. Read source files in that area. Understand what the module accepts, produces, and guarantees.
2. Fill the Contract (Inputs, Outputs, Guarantees) and Behavior sections with what the code reveals.
3. Where the code's behavior is clear but the *intent* is unclear, note it: `> **TODO:** Behavior observed, but intent unclear — verify with module owner.`
4. Deep mode is scoped to the named area only. A full-repo deep read is too slow and token-heavy to be useful.

---

## Phase 6 — Report

After each run, give the user:

- Files created (paths)
- Files updated (paths + what changed)
- Total `> **TODO:**` placeholders remaining across all specs in `specs/`
- Suggested next steps:
  - Re-run `/spec-backfill` at any time to check remaining gaps
  - Run `/spec-backfill go deep in [area]` to fill a specific module
  - Run `/intake` to file any new ideas that surfaced during this review

---

## Placeholder convention

Unfilled spec sections use `> **TODO:** description`. This format:
- Renders visibly in GitHub (blockquote, bold label)
- Is greppable: `> \*\*TODO\*\*`
- Signals clearly that a section needs attention

Filling a placeholder means replacing the `> **TODO:**` line with real content. Partial fills are fine — leave `> **TODO:**` for the parts that remain unknown.

---

## Preferred tools

- **Glob** — discover source roots, test roots, and existing spec coverage
- **Read** — read source files, test files, and existing specs before proposing changes
- **Grep** — find `> **TODO:**` placeholders across existing specs; find test files by path/name pattern
- **Write** — create new spec files after the user approves
- **Edit** — update existing spec files (fill placeholders, add new sections)
