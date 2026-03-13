# Intake

Process ideas from `specs/INTAKE.md` — and from open GitHub Issues — and file them into the appropriate TODO spec files.

## Step 1 — Ensure INTAKE.md exists

Check whether `specs/INTAKE.md` exists.

If it **does not exist**:
1. Create the `specs/` directory if needed.
2. Create `specs/INTAKE.md` with this exact content:

```markdown
# Ideas intake

Not sure where your idea belongs? Drop it here and let the LLMs file it in the right place later!

## AGENTS Instructions

When asked to, take any items listed below and put them into the appropriate `.todo.md` file. Ideas may be vague, rambling, or half-baked. If necessary, ask clarifying questions to determine the user's intent. If a single item refers to multiple components or is a particularly large/complex idea, break it into multiple TODOs across the relevant `.todo.md` files.

Use your best judgment to determine the priority of each item. If a requested item already exists in the TODO spec, that implies a higher priority. If a high priority item is lacking details, always ask the user for more information. When priority is unclear, ask the user.

When you have emptied the submissions section below, leave behind a single bullet:

- *Add your ideas here*.

Items waiting for more information stay in this file with a date annotation: `*(waiting for response, asked YYYY-MM-DD)*`. Re-surface stale items after **7 days** with no reply — change this number to adjust the threshold. If the user asks to defer an item, annotate it as `*(snoozed until YYYY-MM-DD)*` and skip it until that date.

## Submissions

- *Add your ideas here*.
```

Then tell the user the file has been created and stop — there is nothing to process yet.

## Step 2 — Check waiting and snoozed items

Read `specs/INTAKE.md` and scan for items with date annotations before doing anything else.

**For each item annotated `*(waiting for response, asked YYYY-MM-DD)*`:**
1. If the item has a `[#N](url)` prefix, run `gh issue view N --json comments` and check whether any comments were posted after the asked date.
2. New comments found → strip the annotation and re-add the item to the processing queue for this run.
3. No new comments and older than **7 days** (default; see AGENTS Instructions to adjust) → add to the stale list. Surface in the Step 8 report: "Still waiting on #N (asked YYYY-MM-DD)."
4. No new comments and within 7 days → skip silently.

**For each item annotated `*(snoozed until YYYY-MM-DD)*`:**
- Snooze date is in the future → skip entirely.
- Snooze date has passed → strip the annotation and re-add to the processing queue.

**During the run**, if the user says to defer a stale item ("we'll get to it in May", "ignore this for now"):
- Update its annotation to `*(snoozed until YYYY-MM-DD)*` based on what they said.
- Move on without posting to GH.

## Step 3 — Pull from GitHub Issues

**Config:** Read `specs/.meta.json` if it exists and check `auto_create_issues`:
- `true` → enable issue auto-creation for this run.
- `false` → disable; skip silently.
- Key absent (or `.meta.json` missing entirely) → ask the user: *"Should I create a GitHub issue for each manual submission that has no issue link? (Set `auto_create_issues` in `specs/.meta.json` to avoid this prompt.)"*
  - User confirms → treat as `true` for this run.
  - User declines → treat as `false` for this run.
  - No user present (headless) → treat as `false`; note in the Step 8 report that `auto_create_issues` was unset and no issues were created.

1. Run `gh auth status` using the Bash tool.
   - If `gh` is not installed or the user is not authenticated: skip the rest of this step, make a note for the report, and continue to Step 4.
2. Run: `gh issue list --state open --json number,title,url,labels --limit 100`
3. Filter out any issues that already carry one of these labels: `intake:filed`, `intake:rejected`, `intake:ignore`.
4. For each remaining issue, append a bullet to the `## Submissions` section of `specs/INTAKE.md`:
   ```
   - [#N](url) Issue title
   ```
5. If no unprocessed issues are found, note it and continue.

## Step 4 — Read the Submissions

Read `specs/INTAKE.md`. Extract every bullet under `## Submissions` that is not:
- The placeholder `*Add your ideas here*`
- A `*(waiting for response...)*` or `*(snoozed until...)*` item that was not re-queued in Step 2

If nothing remains to process, tell the user and stop (include the Step 8 report if there were stale items to surface).

## Step 5 — Survey existing TODO spec files

Use Grep to find all `*.todo.md` files under `specs/`. Read their headings so you understand what components/areas each file covers. Do not read every line — just enough to map file → component/area.

## Step 6 — Process each item

For each item, determine which of three paths applies:

---

### Path 1 — Routed (clear intent, known target)

You can confidently identify the target `.todo.md` and the item is not a duplicate.

1. **Determine the target.** Match the item to the most relevant `.todo.md`. For work that needs to happen in a dependency, file it in `specs/deps/{repo}.todo.md` (create it if needed). If the item spans multiple components, split it into one entry per relevant file.

2. **Format the entry.** Write it as a plain `- ` bullet. For GH-sourced items, preserve the issue link as a prefix:
   ```
   - [#42](url) Description of what needs to happen
   ```
   For manual items, write a concise, actionable description. If the submission has sub-bullets, preserve them as indented sub-bullets.

3. **Auto-create a GH issue** if the item has no `[#N](url)` prefix, `auto_create_issues` is `true` for this run, **and** Step 3 confirmed that the GitHub CLI is installed and authenticated:
   - If Step 3 reported that `gh` is missing or unauthenticated, **do not** attempt `gh issue create`; treat auto-creation as disabled for this run and record it in the Step 8 report.
   - Otherwise, run: `gh issue create --title "<concise title>" --body "<item description>"`
   - Extract the issue number from the returned URL and update the entry to prepend `[#N](url)`.
   - If creation still fails for any other reason (e.g. permission or network error), continue without a link and note the failure in the Step 8 report.

4. **Create the spec file if missing.** Use this minimal template:
   ```markdown
   # <Component/Area/Dep Name> — TODOs

   - <first item>
   ```
   For dep TODOs, see `specs/deps/README.md` for the recommended template.

5. **Apply a GitHub label** if the item has a `[#N](url)` prefix:
   - **Filed:** `gh issue edit N --add-label "intake:filed"`
   - **User rejects the idea:** `gh issue edit N --add-label "intake:rejected"` — skip filing
   - **User says leave it alone:** `gh issue edit N --add-label "intake:ignore"` — skip filing

6. **Clear from INTAKE.md** (handled in Step 7).

---

### Path 2 — Duplicate+boost (near-identical item already exists)

You find an existing TODO item that covers the same ground.

1. **Find the existing item.** Grep the relevant spec file for similar wording. Show the user what you found: "This item already exists in `<file>`: `<existing text>`."

2. **Boost the existing item:**
   - Append any new details from the duplicate as a sub-bullet on the existing item.
   - If the duplicate has a GH issue, link it as an additional sub-bullet: `  - Also requested: [#N](url)`
   - If this item has now been duplicated multiple times, ask the user whether it should be promoted to a higher section (e.g. Backlog → Later → Sooner). Move it only with user approval.

3. **Apply `intake:filed`** to the duplicate GH issue (if applicable).

4. **Clear from INTAKE.md** (handled in Step 7).

---

### Path 3 — Needs more info (ambiguous routing, missing requirements, low confidence)

You cannot confidently route the item without additional context.

1. **Do not apply any GH label yet.**

2. **Post a comment on the GH issue**, clearly marked as from Claude — not the user:
   ```
   🤖 Claude: automated message from /intake — not from the developer.

   To route this issue I need a bit more information:
   [1–3 specific questions]

   My best routing guess: [target file or component] (confidence: low/medium — reason)

   Reply here to proceed.
   ```
   If a human was present in the chat during this run and discussion happened: summarize that conversation in the comment before the questions, then post. This keeps GH as the canonical record even for supervised runs.

   For items with no GH issue (manual submissions): ask the user directly in chat instead.

3. **Annotate the item** in INTAKE.md by appending `*(waiting for response, asked YYYY-MM-DD)*` (use today's date).

4. **Leave it in INTAKE.md** — do not clear it in Step 7.

---

## Step 7 — Selective clearing of INTAKE.md

After all items are processed, update `specs/INTAKE.md`:
- **Remove** items that were routed (Path 1) or duplicate+boosted (Path 2).
- **Leave** items annotated `*(waiting for response...)*` or `*(snoozed until...)*` exactly as they are.
- Ensure the Submissions section always ends with the placeholder bullet if it would otherwise be empty:
  ```markdown
  - *Add your ideas here*.
  ```

## Step 8 — Report

Give the user a brief summary:
- Which items were filed and where.
- Any items split across multiple spec files.
- Any duplicates found and how they were boosted.
- Any spec files newly created.
- **Waiting:** any items newly marked as waiting for more info (with the GH link).
- **Stale:** any items that have been waiting longer than 7 days with no reply.
- **GitHub:** which issues were labeled and how; any issues auto-created for manual submissions (when `auto_create_issues` is enabled). If `gh` was unavailable, note it here.

## Preferred tools

- **Read** — read INTAKE.md and existing spec files
- **Grep** — find existing TODO spec files and check for duplicate entries
- **Edit** — update spec files and INTAKE.md annotations
- **Write** — create new spec files or INTAKE.md if missing
- **Bash** — `gh` CLI calls only (auth check, issue list, issue view, issue edit, issue comment); use the file tools above for all file operations
