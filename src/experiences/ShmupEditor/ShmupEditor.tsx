import { useMemo, useState } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import { useWindowTitle } from "../../components/Window/useWindowTitle";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import TileList from "./TileList";
import TileEditorForm from "./TileEditorForm";
import ConnectionViewer from "./ConnectionViewer";
import TagGraph from "./TagGraph";
import UnitList from "./UnitList";
import LibraryBrowser, { ALL_FILTER, tileHasTag, tileTags, unitInLayer, type LibraryTab } from "./LibraryBrowser";
import UnitStatsForm from "./UnitStatsForm";
import PartEditor from "./PartEditor";
import EncounterEditor from "./EncounterEditor";
import { loadTiles, saveTiles } from "./tileStore";
import { playtestEncounter } from "./playtestLaunch";
import { clearTileSession, clearUnitDraft, loadTileSession, loadUnitDraft, loadUnits, saveTileSession, saveUnitDraft, saveUnits } from "./unitStore";
import { collectUsedTags } from "./tagRegistry";
import { createBlankTile, createDefaultTileLibrary, makeTileId, type TileDef } from "./types";
import { createBlankPart, createBlankUnit, createDefaultUnitLibrary, makeActionId, makePartId, makeUnitId, type ActionDef, type UnitDef, type UnitPart } from "./unitTypes";
import { createBlankEncounter, type EncounterDef } from "./encounterTypes";
import "./ShmupEditor.css";

type View = "list" | "edit" | "connections" | "graph" | "unit-list" | "unit-edit" | "part-edit" | "encounter-edit";

export default function ShmupEditor() {
  const [tiles, setTiles] = useState<TileDef[]>(() => loadTiles());
  const [units, setUnits] = useState<UnitDef[]>(() => loadUnits());

  // Resume an interrupted editing session silently (root CLAUDE.md's
  // mandatory in-progress-session-survives-reload rule) — a half-built
  // tile/encounter/Unit/Part is a much bigger loss than E1's original
  // tile-form draft gap. Unit edits (which can nest into an in-progress
  // Part) and tile edits (which can nest into an in-progress encounter)
  // use separate session slots since they're mutually exclusive contexts.
  const [editingUnit, setEditingUnit] = useState<UnitDef | null>(() => loadUnitDraft()?.unit ?? null);
  const [editingPart, setEditingPart] = useState<UnitPart | null>(() => loadUnitDraft()?.activePart ?? null);
  const [editingTile, setEditingTile] = useState<TileDef | null>(() => loadTileSession()?.tile ?? null);
  const [editingEncounter, setEditingEncounter] = useState<EncounterDef | null>(() => loadTileSession()?.activeEncounter ?? null);
  /** Tag filter for the Tiles tab and layer filter for the Units tab — view state, never persisted. */
  const [tileTagFilter, setTileTagFilter] = useState<string>(ALL_FILTER);
  const [unitLayerFilter, setUnitLayerFilter] = useState<string>(ALL_FILTER);
  const [view, setView] = useState<View>(() => {
    const unitDraft = loadUnitDraft();
    if (unitDraft?.activePart) return "part-edit";
    if (unitDraft?.unit) return "unit-edit";
    const tileSession = loadTileSession();
    if (tileSession?.activeEncounter) return "encounter-edit";
    if (tileSession?.tile) return "edit";
    return "list";
  });

  // Tags typed in via "+ New tag..." this session but not yet saved on any
  // tile — kept around so the dropdown offers them immediately without
  // requiring a save-then-reopen round trip first.
  const [extraTags, setExtraTags] = useState<string[]>([]);

  // Encounter editor's controls used to explain themselves via inline
  // `.shmup-hint` paragraphs — Noah's "remove all the muted explanatory
  // text, put instructions in the Help menu instead." This is that menu,
  // centralized here (not split across ShmupEditorPage.tsx's StandaloneWindow
  // `helpContent` prop, which used to carry the Tile editor's own tips) so
  // there's exactly one Help menu regardless of whether this experience is
  // hosted inside a Doors 97 Window (no other Help source at all) or the
  // standalone `/shmup-editor` route (StandaloneWindow would otherwise
  // append its own second "Help" label alongside this one).
  const [helpTopic, setHelpTopic] = useState<"tile" | "unit" | "encounter" | null>(null);

  // A stale browser cache (an old TILES.DAT/UNITS.DAT saved before a
  // built-in sprite/tile-image was renamed or removed) can leave the
  // library pointing at art that no longer exists — Noah's ask after the
  // skull-* sprite removal broke his already-seeded local data. This is
  // the escape hatch: wipe both libraries and every in-progress draft,
  // then reseed from the current code's defaults. Destructive and
  // irreversible, so it's gated behind a confirmation modal rather than
  // firing straight from the menu click.
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  function handleResetToDefaults() {
    const freshTiles = createDefaultTileLibrary();
    const freshUnits = createDefaultUnitLibrary();
    saveTiles(freshTiles);
    saveUnits(freshUnits);
    clearTileSession();
    clearUnitDraft();
    setTiles(freshTiles);
    setUnits(freshUnits);
    setExtraTags([]);
    setEditingTile(null);
    setEditingEncounter(null);
    setEditingUnit(null);
    setEditingPart(null);
    setView("list");
    setResetConfirmOpen(false);
    setHelpTopic(null);
  }

  const availableTags = useMemo(() => {
    const merged = new Set([...collectUsedTags(tiles), ...extraTags]);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }, [tiles, extraTags]);

  function registerTag(tag: string) {
    setExtraTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }

  function persist(next: TileDef[]) {
    setTiles(next);
    saveTiles(next);
  }

  function handleNewTile() {
    setEditingTile(createBlankTile(tiles.length));
    setEditingEncounter(null);
    setView("edit");
  }

  function handleEditTile(tile: TileDef) {
    setEditingTile(tile);
    setEditingEncounter(null);
    setView("edit");
  }

  function handleDuplicateTile(tile: TileDef) {
    const now = Date.now();
    const copy: TileDef = { ...tile, id: makeTileId(), name: `${tile.name} copy`, createdAt: now, modifiedAt: now };
    persist([...tiles, copy]);
    // Opening the copy is the feedback: from inside the editor, silently
    // appending to a library you can't currently see would look like nothing
    // happened. The heading and the " copy" name make it obvious which one
    // you're now editing.
    setEditingTile(copy);
    setEditingEncounter(null);
    saveTileSession({ tile: copy, activeEncounter: null });
  }

  /** Invoked from inside the tile editor now, so it has to close the editor too — otherwise you'd be left editing a tile that no longer exists. */
  function handleDeleteTile(tile: TileDef) {
    persist(tiles.filter((t) => t.id !== tile.id));
    setEditingTile(null);
    setEditingEncounter(null);
    clearTileSession();
    setView("list");
  }

  function handleSaveTile(tile: TileDef) {
    const exists = tiles.some((t) => t.id === tile.id);
    persist(exists ? tiles.map((t) => (t.id === tile.id ? tile : t)) : [...tiles, tile]);
    setEditingTile(null);
    clearTileSession();
    setView("list");
  }

  function handleCancelEdit() {
    setEditingTile(null);
    clearTileSession();
    setView("list");
  }

  function handleTileDraftChange(tile: TileDef) {
    setEditingTile(tile);
    // Only fires while TileEditorForm is mounted (view === "edit"), so there's never an active encounter draft at the same time.
    saveTileSession({ tile, activeEncounter: null });
  }

  function handleNewEncounter() {
    if (!editingTile) return;
    const encounter = createBlankEncounter(editingTile.encounters.length);
    setEditingEncounter(encounter);
    saveTileSession({ tile: editingTile, activeEncounter: encounter });
    setView("encounter-edit");
  }

  function handleEditEncounter(encounter: EncounterDef) {
    if (!editingTile) return;
    setEditingEncounter(encounter);
    saveTileSession({ tile: editingTile, activeEncounter: encounter });
    setView("encounter-edit");
  }

  function handleDeleteEncounter(encounterId: string) {
    if (!editingTile) return;
    const next = { ...editingTile, encounters: editingTile.encounters.filter((e) => e.id !== encounterId), modifiedAt: Date.now() };
    setEditingTile(next);
    saveTileSession({ tile: next, activeEncounter: null });
  }

  function handleSaveEncounter(encounter: EncounterDef) {
    if (!editingTile) return;
    const exists = editingTile.encounters.some((e) => e.id === encounter.id);
    const nextTile: TileDef = {
      ...editingTile,
      encounters: exists ? editingTile.encounters.map((e) => (e.id === encounter.id ? encounter : e)) : [...editingTile.encounters, encounter],
      modifiedAt: Date.now(),
    };
    setEditingTile(nextTile);
    setEditingEncounter(null);
    saveTileSession({ tile: nextTile, activeEncounter: null });
    setView("edit");
  }

  /**
   * Merges the encounter into its tile, persists the whole library, then
   * leaves for the game. Persisting the *library* (not just the edit
   * session) is the load-bearing part: the game reads `TILES.DAT` from the
   * shared filesystem, so anything still sitting in an unsaved draft simply
   * wouldn't be there to play.
   */
  function handlePlaytestEncounter(encounter: EncounterDef, difficulty: number) {
    if (!editingTile) return;
    const exists = editingTile.encounters.some((e) => e.id === encounter.id);
    const nextTile: TileDef = {
      ...editingTile,
      encounters: exists ? editingTile.encounters.map((e) => (e.id === encounter.id ? encounter : e)) : [...editingTile.encounters, encounter],
      modifiedAt: Date.now(),
    };
    const tileExists = tiles.some((t) => t.id === nextTile.id);
    persist(tileExists ? tiles.map((t) => (t.id === nextTile.id ? nextTile : t)) : [...tiles, nextTile]);
    // Keep the edit session so coming back from the game lands exactly where
    // you left off, mid-encounter.
    setEditingTile(nextTile);
    saveTileSession({ tile: nextTile, activeEncounter: encounter });
    playtestEncounter(nextTile.id, encounter.id, difficulty);
  }

  function handleCancelEncounterEdit() {
    if (!editingTile) return;
    setEditingEncounter(null);
    saveTileSession({ tile: editingTile, activeEncounter: null });
    setView("edit");
  }

  function handleEncounterDraftChange(encounter: EncounterDef) {
    setEditingEncounter(encounter);
    if (editingTile) saveTileSession({ tile: editingTile, activeEncounter: encounter });
  }

  function persistUnits(next: UnitDef[]) {
    setUnits(next);
    saveUnits(next);
  }

  function handleNewUnit() {
    setEditingUnit(createBlankUnit(units.length));
    setEditingPart(null);
    setView("unit-edit");
  }

  function handleEditUnit(unit: UnitDef) {
    setEditingUnit(unit);
    setEditingPart(null);
    setView("unit-edit");
  }

  /** Regenerates every Action's id in `actions` and returns both the fresh array and the old-id -> new-id map, so a caller holding a reference into the old set (e.g. `defaultActionId`) can be remapped rather than left dangling. */
  function cloneActions(actions: ActionDef[]): { actions: ActionDef[]; idMap: Map<string, string> } {
    const idMap = new Map<string, string>();
    const cloned = actions.map((a) => {
      const id = makeActionId();
      idMap.set(a.id, id);
      return { ...a, id };
    });
    return { actions: cloned, idMap };
  }

  function handleDuplicateUnit(unit: UnitDef) {
    const now = Date.now();
    const { actions, idMap } = cloneActions(unit.actions);
    const copy: UnitDef = {
      ...unit,
      id: makeUnitId(),
      name: `${unit.name} copy`,
      actions,
      defaultActionId: unit.defaultActionId ? (idMap.get(unit.defaultActionId) ?? null) : null,
      parts: unit.parts.map((p) => ({ ...p, id: makePartId(), actions: cloneActions(p.actions).actions })),
      createdAt: now,
      modifiedAt: now,
    };
    persistUnits([...units, copy]);
    // Same reasoning as handleDuplicateTile: open the copy so the duplicate is
    // visible rather than silently appended to a library you can't see.
    setEditingUnit(copy);
    setEditingPart(null);
    saveUnitDraft({ unit: copy, activePart: null });
  }

  /** Invoked from inside the Unit editor now, so it has to close the editor too. */
  function handleDeleteUnit(unit: UnitDef) {
    persistUnits(units.filter((u) => u.id !== unit.id));
    setEditingUnit(null);
    setEditingPart(null);
    clearUnitDraft();
    setView("unit-list");
  }

  function handleSaveUnit(unit: UnitDef) {
    const exists = units.some((u) => u.id === unit.id);
    persistUnits(exists ? units.map((u) => (u.id === unit.id ? unit : u)) : [...units, unit]);
    setEditingUnit(null);
    setEditingPart(null);
    clearUnitDraft();
    setView("unit-list");
  }

  function handleCancelUnitEdit() {
    setEditingUnit(null);
    setEditingPart(null);
    clearUnitDraft();
    setView("unit-list");
  }

  function handleUnitDraftChange(unit: UnitDef) {
    setEditingUnit(unit);
    // Only fires while UnitStatsForm is mounted (view === "unit-edit"), so there's never an active Part draft at the same time.
    saveUnitDraft({ unit, activePart: null });
  }

  function handleNewPart() {
    if (!editingUnit) return;
    const part = createBlankPart(editingUnit.parts.length);
    setEditingPart(part);
    saveUnitDraft({ unit: editingUnit, activePart: part });
    setView("part-edit");
  }

  function handleEditPart(part: UnitPart) {
    if (!editingUnit) return;
    setEditingPart(part);
    saveUnitDraft({ unit: editingUnit, activePart: part });
    setView("part-edit");
  }

  function handleDeletePart(partId: string) {
    if (!editingUnit) return;
    const next = { ...editingUnit, parts: editingUnit.parts.filter((p) => p.id !== partId), modifiedAt: Date.now() };
    setEditingUnit(next);
    saveUnitDraft({ unit: next, activePart: null });
  }

  function handleSavePart(part: UnitPart) {
    if (!editingUnit) return;
    const exists = editingUnit.parts.some((p) => p.id === part.id);
    const nextUnit: UnitDef = {
      ...editingUnit,
      parts: exists ? editingUnit.parts.map((p) => (p.id === part.id ? part : p)) : [...editingUnit.parts, part],
      modifiedAt: Date.now(),
    };
    setEditingUnit(nextUnit);
    setEditingPart(null);
    saveUnitDraft({ unit: nextUnit, activePart: null });
    setView("unit-edit");
  }

  function handleCancelPartEdit() {
    if (!editingUnit) return;
    setEditingPart(null);
    saveUnitDraft({ unit: editingUnit, activePart: null });
    setView("unit-edit");
  }

  function handlePartDraftChange(part: UnitPart) {
    setEditingPart(part);
    if (editingUnit) saveUnitDraft({ unit: editingUnit, activePart: part });
  }

  const menus = useMemo<MenuBarMenu[]>(
    () => [
      {
        label: "Tiles",
        items: [
          { label: "New Tile...", onClick: handleNewTile },
          { separator: true },
          { label: "Tile List", onClick: () => setView("list") },
          { label: "Connection Viewer", onClick: () => setView("connections") },
          { label: "Tag Graph", onClick: () => setView("graph") },
        ],
      },
      {
        label: "Units",
        items: [
          { label: "New Unit...", onClick: handleNewUnit },
          { separator: true },
          { label: "Unit List", onClick: () => setView("unit-list") },
        ],
      },
      {
        label: "Help",
        items: [
          { label: "Tile Editor", onClick: () => setHelpTopic("tile") },
          { label: "Units & Actions", onClick: () => setHelpTopic("unit") },
          { label: "Encounter Editor", onClick: () => setHelpTopic("encounter") },
          { separator: true },
          { label: "Reset to Defaults...", onClick: () => setResetConfirmOpen(true) },
        ],
      },
    ],
    [tiles.length, units.length]
  );
  useWindowMenus(menus);
  // The Connection Viewer trims its own heading to save vertical space —
  // the title bar carries that context instead.
  useWindowTitle(view === "connections" ? "Connection Viewer" : null);

  /** The library tab a browse-level view maps to, or null while an editor is open. */
  const libraryTab: LibraryTab | null =
    view === "list" ? "tiles" : view === "unit-list" ? "units" : view === "connections" || view === "graph" ? "preview" : null;

  function openLibraryTab(next: LibraryTab) {
    setView(next === "tiles" ? "list" : next === "units" ? "unit-list" : "connections");
  }

  const visibleTiles = useMemo(() => tiles.filter((t) => tileHasTag(t, tileTagFilter)), [tiles, tileTagFilter]);
  const visibleUnits = useMemo(() => units.filter((u) => unitInLayer(u, unitLayerFilter)), [units, unitLayerFilter]);
  const allTileTags = useMemo(() => tileTags(tiles), [tiles]);

  return (
    <div className="shmup-editor">
      <div className="shmup-editor__body">
        {libraryTab && (
          <LibraryBrowser
            tab={libraryTab}
            onTabChange={openLibraryTab}
            tileCount={tiles.length}
            unitCount={units.length}
            createLabel={libraryTab === "tiles" ? "+ Create Tile" : "+ Create Unit"}
            onCreate={libraryTab === "tiles" ? handleNewTile : libraryTab === "units" ? handleNewUnit : null}
            filter={
              libraryTab === "tiles" ? (
                <label className="shmup-lib__filter">
                  <span>Tag</span>
                  <select className="shmup-input" value={tileTagFilter} onChange={(e) => setTileTagFilter(e.target.value)}>
                    <option value={ALL_FILTER}>Show All</option>
                    {allTileTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              ) : libraryTab === "units" ? (
                <label className="shmup-lib__filter">
                  <span>Layer</span>
                  <select className="shmup-input" value={unitLayerFilter} onChange={(e) => setUnitLayerFilter(e.target.value)}>
                    <option value={ALL_FILTER}>Show All</option>
                    <option value="ground">Ground</option>
                    <option value="air">Air</option>
                    <option value="doodad">Doodad</option>
                  </select>
                </label>
              ) : null
            }
          >
            {libraryTab === "tiles" && <TileList tiles={visibleTiles} onOpen={handleEditTile} filtered={tileTagFilter !== ALL_FILTER} />}
            {libraryTab === "units" && <UnitList units={visibleUnits} onOpen={handleEditUnit} filtered={unitLayerFilter !== ALL_FILTER} />}
            {libraryTab === "preview" && (
              <div className="shmup-lib__preview">
                <div className="shmup-lib__preview-switch">
                  <button type="button" className={`shmup-btn ${view === "connections" ? "shmup-btn--active" : ""}`} onClick={() => setView("connections")}>
                    Level Layout
                  </button>
                  <button type="button" className={`shmup-btn ${view === "graph" ? "shmup-btn--active" : ""}`} onClick={() => setView("graph")}>
                    Tag Graph
                  </button>
                </div>
                {view === "connections" && <ConnectionViewer tiles={tiles} />}
                {view === "graph" && <TagGraph tiles={tiles} onEditTile={handleEditTile} />}
              </div>
            )}
          </LibraryBrowser>
        )}
        {view === "edit" && editingTile && (
          <>
            <h3 className="shmup-editor__heading">{tiles.some((t) => t.id === editingTile.id) ? "Edit Tile" : "New Tile"}</h3>
            <TileEditorForm
              tile={editingTile}
              availableTags={availableTags}
              onRegisterTag={registerTag}
              onSave={handleSaveTile}
              onCancel={handleCancelEdit}
              onDuplicate={tiles.some((t) => t.id === editingTile.id) ? () => handleDuplicateTile(editingTile) : null}
              onDelete={tiles.some((t) => t.id === editingTile.id) ? () => handleDeleteTile(editingTile) : null}
              onDraftChange={handleTileDraftChange}
              onNewEncounter={handleNewEncounter}
              onEditEncounter={handleEditEncounter}
              onDeleteEncounter={handleDeleteEncounter}
            />
          </>
        )}
        {view === "unit-edit" && editingUnit && (
          <>
            <h3 className="shmup-editor__heading">{units.some((u) => u.id === editingUnit.id) ? "Edit Unit" : "New Unit"}</h3>
            <UnitStatsForm
              unit={editingUnit}
              units={units}
              onSave={handleSaveUnit}
              onCancel={handleCancelUnitEdit}
              onDuplicate={units.some((u) => u.id === editingUnit.id) ? () => handleDuplicateUnit(editingUnit) : null}
              onDelete={units.some((u) => u.id === editingUnit.id) ? () => handleDeleteUnit(editingUnit) : null}
              onDraftChange={handleUnitDraftChange}
              onNewPart={handleNewPart}
              onEditPart={handleEditPart}
              onDeletePart={handleDeletePart}
            />
          </>
        )}
        {view === "part-edit" && editingUnit && editingPart && (
          <>
            <h3 className="shmup-editor__heading">
              {editingUnit.parts.some((p) => p.id === editingPart.id) ? "Edit Part" : "New Part"} — {editingUnit.name}
            </h3>
            <PartEditor
              part={editingPart}
              unit={editingUnit}
              units={units}
              excludeUnitId={editingUnit.id}
              onSave={handleSavePart}
              onCancel={handleCancelPartEdit}
              onDraftChange={handlePartDraftChange}
            />
          </>
        )}
        {view === "encounter-edit" && editingTile && editingEncounter && (
          <>
            <h3 className="shmup-editor__heading">
              {editingTile.encounters.some((e) => e.id === editingEncounter.id) ? "Edit Encounter" : "New Encounter"} — {editingTile.name}
            </h3>
            <EncounterEditor
              tile={editingTile}
              units={units}
              encounter={editingEncounter}
              onSave={handleSaveEncounter}
              onCancel={handleCancelEncounterEdit}
              onPlaytest={handlePlaytestEncounter}
              onDraftChange={handleEncounterDraftChange}
            />
          </>
        )}
      </div>
      {helpTopic && (
        <div className="shmup-help-backdrop" onClick={() => setHelpTopic(null)}>
          <div className="shmup-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shmup-help-modal__header">
              <span>{helpTopic === "tile" ? "Tile Editor" : helpTopic === "unit" ? "Units & Actions" : "Encounter Editor"}</span>
              <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setHelpTopic(null)}>
                ✕
              </button>
            </div>
            {helpTopic === "tile" && (
              <ul className="shmup-help-modal__list">
                <li>Click "+ New Tile" to author a tile's footprint and edges</li>
                <li>North/south edges take one tag per column; east/west are single tags</li>
                <li>Check "Wall" on an edge to mark it hard-wall (nothing may connect there)</li>
                <li>Connector tiles automatically match any south edge</li>
                <li>Use Connection Tester to check whether two tiles actually attach</li>
                <li>Tiles save automatically to TILES.DAT in the virtual filesystem</li>
              </ul>
            )}
            {helpTopic === "unit" && (
              <ul className="shmup-help-modal__list">
                <li>The Stats tab's preview flies the Unit around a demo circuit solved exactly the way a real encounter is — so it shows what this Unit will actually do with a route that has corners in it. The orange ring is its hitbox at true scale; the purple ring is the tightest turn it can make.</li>
                <li>Speed is a Unit's fixed max — an Action's Movement % dial selects how much of it is actually used, so difficulty scaling never has to touch Speed directly.</li>
                <li>Min speed is the slowest it can go. 0 means it can stop — so it drives straight lines and turns on the spot, spending time instead of distance on a corner (a tank, a helicopter). Above 0 it can never stop, so it has a real turning circle and swings wide through corners it can't make (a jet, a ship, anything on wheels).</li>
                <li>Turn °/sec is how fast it changes heading. With Min speed it gives the turning circle: min speed ÷ turn rate. A fast jet with a good turn rate still corners wide, because it's carrying speed through the turn.</li>
                <li>You never have to make a route "legal" — place the waypoints you want and the editor bends the path into something the Unit can actually fly through all of them, or gets as close as the geometry allows.</li>
                <li>Layer (Ground/Air/Doodad) picks which roster a Unit shows up under in the Encounter editor's "+ Add" picker.</li>
                <li>Visuals is the sprite (built-in or your own upload); animation will live there too once it exists.</li>
                <li>Default Action (Actions tab) is used when this Unit is spawned dynamically (e.g. as another Action's projectile) rather than hand-placed on a tile.</li>
                <li>An Action's own Actions buffet is used directly when the Unit has no Parts; a Part's own Actions govern that Part's independent attack track instead.</li>
                <li>A Part's Position tab: drag its sprite over the dimmed reference of the Unit's own body (or use the Offset dials) — this anchors that Part's Actions' facing/attack.</li>
                <li>A Part's Hitbox tab: unchecked = fused to the Unit's body, damage attributed to the Unit. Checked = its own hitbox, subject to Damage x (a weak point &gt;1, armor &lt;1); its own HP pool if Has HP is also checked, otherwise damage passes through to the Unit's shared HP.</li>
                <li>An Action's Movement % of 0 = stationary. Facing "Fixed" uses the Angle dial; "Follows movement"/"Faces the player" ignore it.</li>
                <li>An Action's Sets Invincible: "no change" carries the previous value forward; Invincible hides the sprite as a temporary stand-in until real animations exist.</li>
                <li>An Action's Attack fires relative to its own Facing — 0/0 is a single shot straight ahead, 0/360 a full radial burst, a gap like 5/355 leaves a safe lane at the facing direction.</li>
                <li>Sweep speed rotates the whole arc over time (0 = static) — this is "rotating"/spiral fire, not a separate mode.</li>
                <li>"Fire for as long as this Action runs" (unchecked) reveals Burst count — a fixed number of bursts instead of firing indefinitely.</li>
                <li>Collision group controls which spawned things can hit each other in the eventual game runtime — same group never hits itself, and the two projectile groups never hit each other either.</li>
                <li>Dials: drag up/down to change, tap the number to type one, right-click or press-and-hold to reset.</li>
              </ul>
            )}
            {helpTopic === "encounter" && (
              <ul className="shmup-help-modal__list">
                <li>Tap a step to select it; drag ✥ to move, teal ⬦ handles bend the curve.</li>
                <li>+ (last step) adds the next step.</li>
                <li>
                  Every Part of a placed Unit gets its own timeline lane, already carrying whatever it does on spawn. Select a dot on a Part's
                  lane and press + to schedule another Action at the playhead; the Part tab's Time dial moves it afterwards. There's one Action
                  type throughout — a Part Action may fire something or may just be state, exactly like the Unit's own.
                </li>
                <li>A Unit's Part lanes are only expanded while that Unit is selected; otherwise they fold into one hairline row, so a four-turret battleship doesn't own the whole ruler.</li>
                <li>⚖️ (first step) opens Scaling — duplicates replay the whole sequence on a draggable shape.</li>
                <li>Dashed box = the tile's real footprint/edges.</li>
                <li>Step timing is usually automatic (distance ÷ the step's own Action's Movement %) — pick a different (or Cloned) Action to retime a moving segment; drag-to-retime only works on a manually-timed (first or dwelling) step.</li>
                <li>An Action's own duration (when it has an attack) is computed from its burst/telegraph/repeat fields, not hand-edited — shown as a read-only readout on a selected Part-track placement.</li>
                <li>Scaling: Difficulty splits evenly across however many instances Min Cost affords, capped at Max Count. Low cost = a swarm; high cost = fewer, stronger.</li>
                <li>
                  Ground / Air (top right, by the timeline) switches which reference frame you're authoring in — they really are two different
                  spaces. In Ground the tile holds still and the camera climbs it. In Air the camera holds still and the terrain slides down
                  through it, because an aircraft isn't bolted to the ground.
                </li>
                <li>
                  The other frame stays visible but dimmed and untappable, and its timeline track shrinks to a hairline — enough to line your
                  timings up against, not enough to get in the way. + Add offers whichever roster matches the current frame (Doodad counts as
                  Ground; it scrolls with the terrain too).
                </li>
                <li>
                  An air Unit's route is fixed to the screen for its whole life — it never rides the terrain, so what you draw in the Air frame is
                  exactly where it flies. To have one enter from off-screen, draw that: put its first step outside the dotted camera box and a later
                  one inside it.
                </li>
                <li>⊡ (top-left of canvas) toggles a real-scale hitbox preview: red boxes = ground enemies, amber = air, red dots = bullets, green circle = reference player hitbox, thick yellow border = tile bounds, dotted border = roughly what's on screen at once.</li>
                <li>⛶ (top-right of canvas) fills the screen with the viewport; Esc or tap it again to shrink back.</li>
                <li>Dials: drag up/down to change, tap the number to type one, right-click or press-and-hold to reset.</li>
              </ul>
            )}
          </div>
        </div>
      )}
      {resetConfirmOpen && (
        <div className="shmup-help-backdrop" onClick={() => setResetConfirmOpen(false)}>
          <div className="shmup-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shmup-help-modal__header">
              <span>Reset to Defaults</span>
              <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setResetConfirmOpen(false)}>
                ✕
              </button>
            </div>
            <p className="shmup-help-modal__body">
              This erases every tile and Unit you've authored (including any in-progress edits) and replaces the library with the
              site's current defaults. This cannot be undone.
            </p>
            <div className="shmup-btn-row">
              <button type="button" className="shmup-btn shmup-btn--small shmup-btn--danger" onClick={handleResetToDefaults}>
                Reset to Defaults
              </button>
              <button type="button" className="shmup-btn shmup-btn--small" onClick={() => setResetConfirmOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
