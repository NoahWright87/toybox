# NS Doors 97 — App Registration Checklist

When adding a new app/game/tool to NS Doors 97 (or wiring up an existing standalone experience as a Doors 97 window), every item below must be done. **Missing the Taskbar entry is the single most common omission** — the app will open fine via the file browser (`My Doors`) but won't be reachable from the Start Menu, which is how most users actually launch things.

## Checklist

1. **Component import** — import the experience component at the top of `NsDoors97.tsx`.
2. **`AppAction` union** — add the new action id (e.g. `"brick-breaker"`) to the `AppAction` type union.
3. **`APP_REGISTRY`** — add `{ title, icon, action }` so the app has a display name/icon wherever `APP_REGISTRY` is consulted (e.g. desktop icons, file browser).
4. **`WindowContent` union** — add `{ type: "your-app-id" }` to the union of possible window content types.
5. **`openWindow` switch** — add a `case` that sets `content = { type: "your-app-id" as const }` and a sensible default `width` (and `height` if relevant).
6. **Window render block** — add `{win.content.type === "your-app-id" && <YourComponent onQuit={() => closeWindow(win.id)} />}`.
7. **Taskbar Start Menu — `Taskbar.tsx`** — add `{ id: "your-app-id", icon: "...", label: "..." }` to `GAMES_ITEMS` (games) or `TOOLS_ITEMS` (accessories/tools). The `id` must match the `AppAction`/`APP_REGISTRY` key from steps 2–3 — `handleOpenApp(item.id)` dispatches directly to `onOpenApp`. **This is the step that gets forgotten.**
8. **Filesystem integration** — if the app persists data (scores, settings, files):
   - Add a stable ID to `filesystem/types.ts`.
   - Create the folder/`.exe`/data file in `filesystem/seed.ts` (new installs).
   - Add an equivalent block in `FileSystemStore.ts`'s `migrate()` (existing sessions).
   - Set `appId: "your-app-id"` on the `.exe` file so double-clicking it from the file browser opens the app.
9. **Standalone route** (if applicable) — `src/App.tsx` route + `src/pages/{Name}Page.tsx` wrapping the component in `StandaloneWindow`.
10. **`src/data/experiences.ts`** — registry entry (id, title, description, category, path).

## Verifying step 7 specifically

After wiring everything up, open the Start Menu → Programs (or Accessories) and confirm the new app appears and launches a window when clicked. Don't rely solely on opening the `.exe` from `My Doors` — that path bypasses the Taskbar entirely and will pass even if step 7 was skipped.
