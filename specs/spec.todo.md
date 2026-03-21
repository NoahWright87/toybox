# Toybox — Roadmap

## Summary

Future work for this repo. Add projects and features here as they are planned.

## Sooner

### Agent Pipeline Integration

Wire up `toybox` as the first target repo in the home-lab automation pipeline. Feature requests arrive from Discord as GitHub Issues (label: `agent-task`), the spec-template agent worker implements them and opens PRs, Netlify deploys previews, and a GitHub Action notifies the user back in Discord.

**Netlify setup (manual — requires Netlify UI):**
1. Log into Netlify and import the `NoahWright87/toybox` GitHub repo
2. Set build command: `npm run build`, publish directory: `dist`
3. Enable "Deploy Previews" for pull requests
4. After connecting, add `DISCORD_WEBHOOK_URL` as a GitHub Actions secret in the toybox repo settings (used by the notification workflow below)

## Later

## Backlog

## Ideas (Uncommitted)

## Reminders

- Move completed items to `spec.md` — this file is for future plans, not current state
- Large or complex ideas belong in their own `{feature}.todo.md`, not buried here
- Items flow: INTAKE → `spec.todo.md` → `{feature}.todo.md` (if big) → `spec.md` (when done)
- If a TODO item links to a GH issue (`[#N](...)`), include `closes #N` in your PR description — GitHub closes the issue on merge
