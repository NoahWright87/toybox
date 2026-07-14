import { useMemo, useState } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import { useWindowTitle } from "../../components/Window/useWindowTitle";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import TileList from "./TileList";
import TileEditorForm from "./TileEditorForm";
import ConnectionViewer from "./ConnectionViewer";
import TagGraph from "./TagGraph";
import UnitList from "./UnitList";
import UnitStatsForm from "./UnitStatsForm";
import ActionEditor from "./ActionEditor";
import PartEditor from "./PartEditor";
import EncounterEditor from "./EncounterEditor";
import { loadTiles, saveTiles } from "./tileStore";
import { clearTileSession, clearUnitDraft, loadTileSession, loadUnitDraft, loadUnits, saveTileSession, saveUnitDraft, saveUnits } from "./unitStore";
import { collectUsedTags } from "./tagRegistry";
import { createBlankTile, makeTileId, type TileDef } from "./types";
import { createBlankAction, createBlankPart, createBlankUnit, makeActionId, makePartId, makeUnitId, makeWeaponId, type ActionDef, type UnitDef, type UnitPart } from "./unitTypes";
import { createBlankEncounter, type EncounterDef } from "./encounterTypes";
import "./ShmupEditor.css";

type View = "list" | "edit" | "connections" | "graph" | "unit-list" | "unit-edit" | "action-edit" | "part-edit" | "encounter-edit";

export default function ShmupEditor() {
  const [tiles, setTiles] = useState<TileDef[]>(() => loadTiles());
  const [units, setUnits] = useState<UnitDef[]>(() => loadUnits());

  // Resume an interrupted editing session silently (root CLAUDE.md's
  // mandatory in-progress-session-survives-reload rule) — a half-built
  // tile/encounter/Unit/Action is a much bigger loss than E1's original
  // tile-form draft gap. Unit edits (which can nest into an in-progress
  // Action) and tile edits (which can nest into an in-progress encounter)
  // use separate session slots since they're mutually exclusive contexts.
  const [editingUnit, setEditingUnit] = useState<UnitDef | null>(() => loadUnitDraft()?.unit ?? null);
  const [editingAction, setEditingAction] = useState<ActionDef | null>(() => loadUnitDraft()?.activeAction ?? null);
  const [editingPart, setEditingPart] = useState<UnitPart | null>(() => loadUnitDraft()?.activePart ?? null);
  const [editingTile, setEditingTile] = useState<TileDef | null>(() => loadTileSession()?.tile ?? null);
  const [editingEncounter, setEditingEncounter] = useState<EncounterDef | null>(() => loadTileSession()?.activeEncounter ?? null);
  const [view, setView] = useState<View>(() => {
    const unitDraft = loadUnitDraft();
    if (unitDraft?.activeAction) return "action-edit";
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
  }

  function handleDeleteTile(tile: TileDef) {
    persist(tiles.filter((t) => t.id !== tile.id));
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
    setEditingAction(null);
    setEditingPart(null);
    setView("unit-edit");
  }

  function handleEditUnit(unit: UnitDef) {
    setEditingUnit(unit);
    setEditingAction(null);
    setEditingPart(null);
    setView("unit-edit");
  }

  function handleDuplicateUnit(unit: UnitDef) {
    const now = Date.now();
    const copy: UnitDef = {
      ...unit,
      id: makeUnitId(),
      name: `${unit.name} copy`,
      actions: unit.actions.map((a) => ({ ...a, id: makeActionId() })),
      parts: unit.parts.map((p) => ({ ...p, id: makePartId(), weapons: p.weapons.map((w) => ({ ...w, id: makeWeaponId() })) })),
      createdAt: now,
      modifiedAt: now,
    };
    persistUnits([...units, copy]);
  }

  function handleDeleteUnit(unit: UnitDef) {
    persistUnits(units.filter((u) => u.id !== unit.id));
  }

  function handleSaveUnit(unit: UnitDef) {
    const exists = units.some((u) => u.id === unit.id);
    persistUnits(exists ? units.map((u) => (u.id === unit.id ? unit : u)) : [...units, unit]);
    setEditingUnit(null);
    setEditingAction(null);
    setEditingPart(null);
    clearUnitDraft();
    setView("unit-list");
  }

  function handleCancelUnitEdit() {
    setEditingUnit(null);
    setEditingAction(null);
    setEditingPart(null);
    clearUnitDraft();
    setView("unit-list");
  }

  function handleUnitDraftChange(unit: UnitDef) {
    setEditingUnit(unit);
    // Only fires while UnitStatsForm is mounted (view === "unit-edit"), so there's never an active Action/Part draft at the same time.
    saveUnitDraft({ unit, activeAction: null, activePart: null });
  }

  function handleNewAction() {
    if (!editingUnit) return;
    const action = createBlankAction(editingUnit.actions.length);
    setEditingAction(action);
    saveUnitDraft({ unit: editingUnit, activeAction: action, activePart: null });
    setView("action-edit");
  }

  function handleEditAction(action: ActionDef) {
    if (!editingUnit) return;
    setEditingAction(action);
    saveUnitDraft({ unit: editingUnit, activeAction: action, activePart: null });
    setView("action-edit");
  }

  function handleDeleteAction(actionId: string) {
    if (!editingUnit) return;
    const next = { ...editingUnit, actions: editingUnit.actions.filter((a) => a.id !== actionId), modifiedAt: Date.now() };
    setEditingUnit(next);
    saveUnitDraft({ unit: next, activeAction: null, activePart: null });
  }

  function handleSaveAction(action: ActionDef) {
    if (!editingUnit) return;
    const exists = editingUnit.actions.some((a) => a.id === action.id);
    const nextUnit: UnitDef = {
      ...editingUnit,
      actions: exists ? editingUnit.actions.map((a) => (a.id === action.id ? action : a)) : [...editingUnit.actions, action],
      modifiedAt: Date.now(),
    };
    setEditingUnit(nextUnit);
    setEditingAction(null);
    saveUnitDraft({ unit: nextUnit, activeAction: null, activePart: null });
    setView("unit-edit");
  }

  function handleCancelActionEdit() {
    if (!editingUnit) return;
    setEditingAction(null);
    saveUnitDraft({ unit: editingUnit, activeAction: null, activePart: null });
    setView("unit-edit");
  }

  function handleActionDraftChange(action: ActionDef) {
    setEditingAction(action);
    if (editingUnit) saveUnitDraft({ unit: editingUnit, activeAction: action, activePart: null });
  }

  function handleNewPart() {
    if (!editingUnit) return;
    const part = createBlankPart(editingUnit.parts.length);
    setEditingPart(part);
    saveUnitDraft({ unit: editingUnit, activeAction: null, activePart: part });
    setView("part-edit");
  }

  function handleEditPart(part: UnitPart) {
    if (!editingUnit) return;
    setEditingPart(part);
    saveUnitDraft({ unit: editingUnit, activeAction: null, activePart: part });
    setView("part-edit");
  }

  function handleDeletePart(partId: string) {
    if (!editingUnit) return;
    const next = { ...editingUnit, parts: editingUnit.parts.filter((p) => p.id !== partId), modifiedAt: Date.now() };
    setEditingUnit(next);
    saveUnitDraft({ unit: next, activeAction: null, activePart: null });
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
    saveUnitDraft({ unit: nextUnit, activeAction: null, activePart: null });
    setView("unit-edit");
  }

  function handleCancelPartEdit() {
    if (!editingUnit) return;
    setEditingPart(null);
    saveUnitDraft({ unit: editingUnit, activeAction: null, activePart: null });
    setView("unit-edit");
  }

  function handlePartDraftChange(part: UnitPart) {
    setEditingPart(part);
    if (editingUnit) saveUnitDraft({ unit: editingUnit, activeAction: null, activePart: part });
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
    ],
    [tiles.length, units.length]
  );
  useWindowMenus(menus);
  // The Connection Viewer trims its own heading to save vertical space —
  // the title bar carries that context instead.
  useWindowTitle(view === "connections" ? "Connection Viewer" : null);

  return (
    <div className="shmup-editor">
      <div className="shmup-editor__body">
        {view === "list" && (
          <>
            <h3 className="shmup-editor__heading">Tile Library ({tiles.length})</h3>
            <TileList tiles={tiles} onEdit={handleEditTile} onDuplicate={handleDuplicateTile} onDelete={handleDeleteTile} />
          </>
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
              onDraftChange={handleTileDraftChange}
              onNewEncounter={handleNewEncounter}
              onEditEncounter={handleEditEncounter}
              onDeleteEncounter={handleDeleteEncounter}
            />
          </>
        )}
        {view === "connections" && <ConnectionViewer tiles={tiles} />}
        {view === "graph" && (
          <>
            <h3 className="shmup-editor__heading">Tag Graph</h3>
            <TagGraph tiles={tiles} onEditTile={handleEditTile} />
          </>
        )}
        {view === "unit-list" && (
          <>
            <h3 className="shmup-editor__heading">Unit Library ({units.length})</h3>
            <UnitList units={units} onEdit={handleEditUnit} onDuplicate={handleDuplicateUnit} onDelete={handleDeleteUnit} />
          </>
        )}
        {view === "unit-edit" && editingUnit && (
          <>
            <h3 className="shmup-editor__heading">{units.some((u) => u.id === editingUnit.id) ? "Edit Unit" : "New Unit"}</h3>
            <UnitStatsForm
              unit={editingUnit}
              onSave={handleSaveUnit}
              onCancel={handleCancelUnitEdit}
              onDraftChange={handleUnitDraftChange}
              onNewAction={handleNewAction}
              onEditAction={handleEditAction}
              onDeleteAction={handleDeleteAction}
              onNewPart={handleNewPart}
              onEditPart={handleEditPart}
              onDeletePart={handleDeletePart}
            />
          </>
        )}
        {view === "action-edit" && editingUnit && editingAction && (
          <>
            <h3 className="shmup-editor__heading">
              {editingUnit.actions.some((a) => a.id === editingAction.id) ? "Edit Action" : "New Action"} — {editingUnit.name}
            </h3>
            <ActionEditor action={editingAction} onSave={handleSaveAction} onCancel={handleCancelActionEdit} onDraftChange={handleActionDraftChange} />
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
              onDraftChange={handleEncounterDraftChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
