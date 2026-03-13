# Dependency Specs

The `deps/` directory holds specs and outbound TODO files for repositories this project depends on.

## Files

- **`{name}.spec.md`** — outsider knowledge about the dep: what it does from our perspective, why we use it, how we interface with it, who owns it, known quirks. Written for routing — enough context for an agent or new teammate to understand the dep without digging into its codebase.
- **`{name}.todo.md`** — work items that need to happen *in that repo*. "Implementing" one of these means opening a GitHub issue there. `/knock-out-todos` handles that step and records the downstream issue as a sub-bullet on the TODO item.

## Dep spec template

```markdown
# {Dep Name}

**What it does:** What this dep is for, from our perspective — the problem it solves for us.
**Why we use it:** Why it was chosen; what gap it fills; any history worth knowing.
**Interface:** How we call it (REST API, npm package, event bus, shared DB, etc.)
**Owner:** Team or person responsible for the dep.
**GitHub:** [link](url)
**Notes:** Quirks, gotchas, or limitations we've discovered through use.
```

## Dep TODO format

```markdown
# {Dep Name} — Outbound TODOs

Work that needs to happen in [{dep name}]({github url}).
"Implementing" a TODO here means opening a GitHub issue in that repo.

- [ ] [#local-issue](url) Description of what needs to happen in {dep name}
  - [{dep-name}#{N}]({url}) ← downstream issue, added by /knock-out-todos once opened
```

When `/knock-out-todos` picks up a dep TODO, it:
1. Opens a GitHub issue in the target repo
2. Adds a sub-bullet with the downstream issue link
3. Cross-links both issues with comments for traceability

When all sub-bullet dep issues are closed, the main item is unblocked. Once validated/implemented, it moves to `spec.md` — without the sub-bullets, which are implementation history, not current state.

## Reminders

- Dep specs describe *our relationship* to the dep, not the dep's internal design
- Keep dep specs short — just enough to route work confidently
- Outbound TODOs go in `{name}.todo.md`; changes to *our* codebase go in the regular `spec.todo.md`
