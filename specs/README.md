# Specs

This directory contains **spec-driven source-of-truth documents** for this repository.
Specs mirror the source tree and describe *what the system is and how it behaves*, not how it is implemented.

## Core rules
- `spec.md` is the **root spec** for each directory.
- Every `spec.md` must have a neighboring `spec.todo.md`.
- Additional specs are named `{feature}.spec.md` and use the same template.
- Specs must include a **Related** section that links only to other specs (not TODOs).

## File types

### `spec.md`
Primary specification for a page, feature, system, or module.
Describes the **current, shippable contract**.

### `{feature}.spec.md`
Focused spec for a sub-feature or component.
Same structure as `spec.md`, just smaller in scope.

### `spec.todo.md`
Roadmap for future work related to its neighboring spec.
Prioritized from top to bottom.

### `{feature}.todo.md`
Elaborated plan for a specific feature or idea — extracted from `spec.todo.md` when an item grows large or complex enough to warrant its own space. Functions as a PRD or HLD, all in-repo. When implemented, it graduates to `{feature}.spec.md`.

INTAKE can seed a `{feature}.todo.md` directly when a submitted idea is substantial enough to open a refinement conversation rather than file as a simple bullet.

### `deps/`
Specs and outbound TODO files for repositories this project depends on. Each dep gets a `{name}.spec.md` (outsider knowledge — what it does from our perspective, why we use it) and optionally a `{name}.todo.md` (work items that need to happen in that repo). See [`deps/README.md`](deps/README.md) for templates and the full pattern.

## Split rule

Applies to both spec files and TODO spec files.

- Split when a file grows past **300 lines**.
- A file at **500 lines** must be split before further work continues.
- Use judgment for TODO files too: if a single idea has enough sub-concerns to benefit from its own space, extract it into `{feature}.todo.md` before hitting the line limits.

## Writing guidelines
- Prefer **behavior over implementation**
- Be explicit where ambiguity could cause bugs
- Keep specs short, readable, and skimmable
- If it's not current behavior, it belongs in `spec.todo.md`
