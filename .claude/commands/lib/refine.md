# Refine

Add technical detail, effort estimates, and priority adjustments to the highest-priority open TODO items — the middle step between `/intake` and `/knock-out-todos`.

The user may specify how many items to refine — default is **3** if not stated.

---

## Step 1 — Find and prioritize TODO items

Use Grep to search for `^- ` across all `specs/**/*.todo.md` files.

**Skip items that are:**
- Already refined: have a `*(effort: ...)` annotation **and** at least one indented technical sub-bullet
- Snoozed: annotated `*(snoozed until YYYY-MM-DD)*` where the date is still in the future
- Reminders or section headings (lines not starting with `- `)

**Re-check waiting items first.** For each item annotated `*(waiting for response, asked YYYY-MM-DD)*`:
1. If the item has a `[#N](url)` prefix, run `gh issue view N --json comments` and check for comments posted after the asked date.
2. New comments found → strip the annotation and add the item to the candidate pool (treat as high priority — the user has responded).
3. No new comments and older than **7 days** → add to the stale list for Step 6.
4. No new comments and within 7 days → skip silently.

**Prioritize candidates:**
1. Items in "Sooner" sections before "Later" before "Backlog" within each file
2. Higher position in the file (earlier = higher priority)
3. Items with a `[#N](url)` GH issue prefix (proxy for stakeholder interest)

Select the top N items (default 3; user-specified number overrides).

---

## Step 2 — Load context for each item

For each selected item:

1. **GH issue details:** If the item has a `[#N](url)` prefix, run `gh issue view N --json title,body,comments`. Read the body and all comments — these may contain requirements, constraints, or previous discussion.
2. **Spec file context:** Read the containing `.todo.md` file to understand the area and neighboring items.
3. **Current state:** Read the relevant component spec (`specs/spec.md`, `specs/scaffold.md`, `specs/worker.md`, etc.) to understand what already exists.
4. **Source scan:** If relevant source files exist and are small, do a light scan to understand the implementation surface.

---

## Step 3 — Assess and refine each item

For each item, work through these questions:

**Clarity check:**
- Is the **what** (deliverable, behavior, interface) clear enough to implement without guessing?
- Is the **why** (purpose, user value, problem being solved) clear?
- Are there **implementation decisions** that need to be made before work can start?
- Are there known **dependencies** or **risks**?

**Estimate effort** using these labels — based on complexity and scope, not time:
- **XS** — trivial; self-contained, no risk of side effects
- **S** — small and well-understood; clear scope, minimal coordination needed
- **M** — moderate; spans a few files or touches non-trivial logic
- **L** — substantial; crosses components or requires careful coordination
- **XL** — large and complex; must be broken down before implementation. If it keeps growing during refinement, consider splitting into a new `.todo.md` file or chunking into smaller sequential items.
- **Unknown** — not enough context to assess complexity yet

Append 0–3 `?` marks to indicate confidence in the estimate: `*(effort: XL)*` = high confidence; `*(effort: M?)*` = probably Medium; `*(effort: S???)*` = rough guess. Use more `?`s when estimating from limited context.

---

### If supervised (user present in chat)

- Ask questions directly in chat. Work iteratively — do not write anything to files until key ambiguities are resolved.
- Confirm the effort estimate with the user.
- If the user adjusts scope, priority, or approach during discussion, note it before writing.
- Get explicit sign-off from the user before proceeding to Step 4.

---

### If headless (no user in chat)

- Make a best-effort assessment using available context (GH issue body/comments, spec files, source).
- For questions about **product decisions or intent** (the "why" or "what") that cannot be answered from context, post a clarifying comment on the GH issue:

  ```
  🤖 Spec Agent, reporting for refinement duty! 🫡

  I'm preparing this item for implementation and have some questions:
  [1–3 specific, answerable questions]

  My current understanding: [brief summary of what will be built and how]
  Estimated effort: [XS/S/M/L/XL — one-line reasoning focused on complexity and scope]

  Once you clarify things for me, I'll get these todos refined and ready! 💎 🫡
  ```

- Annotate the item as `*(waiting for response, asked YYYY-MM-DD)*` if key product decisions remain unanswered.
- Still add an effort estimate and whatever technical detail can be inferred from context — do not leave the item completely unrefined just because some questions remain. Make your best guess and use more `?` marks where confidence is low. If context is sparse, `???` signals to reviewers that clarification is needed.
- Where clarity is low, append up to 3 `?` marks to individual technical sub-bullet sentences to flag guesses and prompt reviewers to clarify further.

---

## Step 4 — Write updates to spec and TODO files

**In the `.todo.md` file:**

Add an inline effort estimate and technical sub-bullets to each refined item:

```
- [#N](url) Description of the item *(effort: M)*
  - Implementation: [brief technical approach — how it will be built]
  - Depends on: [prerequisites or blockers, if any]
```

If no GH issue prefix exists:
```
- Description of the item *(effort: S)*
  - Implementation: [brief technical approach]
```

Append `?` marks to the effort label to reflect confidence: `*(effort: M?)*` = probably Medium; `*(effort: S???)*` = rough guess. Append `?` marks to the end of individual sub-bullet sentences where you're guessing — to flag areas that need reviewer clarification.

Additional rules:
- If priority was adjusted during Step 3, move the item to the appropriate section (Sooner / Later / Backlog).
- If a GH comment was posted in headless mode, append `*(waiting for response, asked YYYY-MM-DD)*` to the item.
- Do not add speculative or unconfirmed details — only what was agreed or clearly inferable.

**In related spec files** (only when the purpose or approach genuinely improved):
- Add or update the feature description in `spec.md` or the relevant component spec.
- Do not add unconfirmed design decisions.

---

## Step 5 — Commit and open a PR

### Supervised

After the user gives sign-off in Step 3:
1. Commit all changes.
2. Push the branch.
3. Ask the user: *"Ready to open a PR with these changes?"*
4. On confirmation, run:
   ```
   gh pr create --title "refine: ..." --body "..."
   ```
   PR body should include:
   - List of items refined with their effort estimates
   - Any outstanding questions (items still waiting for GH replies)
   - `closes #N` for any GH issues that are now fully defined

### Headless

1. Commit all changes.
2. Push the branch.
3. Run `gh pr create` automatically. Preface the PR body with one of:

   If refinement went smoothly:
   > 🤖 Spec Agent, reporting in from refinement! 🫡 I've refined your todo items and want to make sure I've got the details right. Comment on this PR and/or comment on the GH issues to steer me in the right direction.

   If many items have high uncertainty (`???`):
   > 🤖 Spec Agent, reporting in from refinement! 🫡 I did my best, boss, but I've got a lot of questions. Please review my updates and comment to clarify things for me, especially in areas where I've got a ton of `??`s 😅

   Then include:
   - List of items refined with effort estimates and brief implementation summary
   - Outstanding questions: items where GH comments were posted (with issue links)
   - `closes #N` lines for any GH issues that are fully defined and no longer need questions answered

**PR title format:** `refine: add detail and estimates for [item names or area]`

---

## Step 6 — Report

Give the user (or include in the PR description) a brief summary:
- **Refined:** each item, its new effort estimate, and the key technical decision or clarification added
- **Waiting:** items where a GH comment was posted asking for more info (with issue link)
- **Stale:** items that have been waiting longer than 7 days with no reply
- **PR:** link to the opened PR

---

## Preferred tools

- **Grep** — find TODO items across spec files
- **Read** — read spec files, GH issue details, source files for context
- **Edit** — update TODO items and spec files
- **Bash** — `gh` CLI calls only (issue view, issue comment, pr create); use the file tools above for all file operations
