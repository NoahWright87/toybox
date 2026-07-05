import { useMemo, useState } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import { useWindowTitle } from "../../components/Window/useWindowTitle";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import TileList from "./TileList";
import TileEditorForm from "./TileEditorForm";
import ConnectionViewer from "./ConnectionViewer";
import TagGraph from "./TagGraph";
import EnemyList from "./EnemyList";
import EnemyStatsForm from "./EnemyStatsForm";
import EncounterEditor from "./EncounterEditor";
import { loadTiles, saveTiles } from "./tileStore";
import { clearEnemyDraft, clearTileSession, loadEnemies, loadEnemyDraft, loadTileSession, saveEnemies, saveEnemyDraft, saveTileSession } from "./enemyStore";
import { collectUsedTags } from "./tagRegistry";
import { createBlankTile, makeTileId, type TileDef } from "./types";
import { createBlankEnemy, makeEnemyId, type EnemyDef } from "./enemyTypes";
import { createBlankEncounter, type EncounterDef } from "./encounterTypes";
import "./ShmupEditor.css";

type View = "list" | "edit" | "connections" | "graph" | "enemy-list" | "enemy-edit" | "encounter-edit";

export default function ShmupEditor() {
  const [tiles, setTiles] = useState<TileDef[]>(() => loadTiles());
  const [enemies, setEnemies] = useState<EnemyDef[]>(() => loadEnemies());

  // Resume an interrupted editing session silently (root CLAUDE.md's
  // mandatory in-progress-session-survives-reload rule) — a half-built
  // tile/encounter/enemy is a much bigger loss than E1's original tile-form
  // draft gap. Enemy edits and tile edits (which can nest into an
  // in-progress encounter) use separate session slots since they're
  // mutually exclusive editing contexts.
  const [editingEnemyDef, setEditingEnemyDef] = useState<EnemyDef | null>(() => loadEnemyDraft());
  const [editingTile, setEditingTile] = useState<TileDef | null>(() => loadTileSession()?.tile ?? null);
  const [editingEncounter, setEditingEncounter] = useState<EncounterDef | null>(() => loadTileSession()?.activeEncounter ?? null);
  const [view, setView] = useState<View>(() => {
    if (loadEnemyDraft()) return "enemy-edit";
    const session = loadTileSession();
    if (session?.activeEncounter) return "encounter-edit";
    if (session?.tile) return "edit";
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

  function persistEnemies(next: EnemyDef[]) {
    setEnemies(next);
    saveEnemies(next);
  }

  function handleNewEnemy() {
    setEditingEnemyDef(createBlankEnemy(enemies.length));
    setView("enemy-edit");
  }

  function handleEditEnemy(enemy: EnemyDef) {
    setEditingEnemyDef(enemy);
    setView("enemy-edit");
  }

  function handleDuplicateEnemy(enemy: EnemyDef) {
    const now = Date.now();
    const copy: EnemyDef = { ...enemy, id: makeEnemyId(), name: `${enemy.name} copy`, createdAt: now, modifiedAt: now };
    persistEnemies([...enemies, copy]);
  }

  function handleDeleteEnemy(enemy: EnemyDef) {
    persistEnemies(enemies.filter((e) => e.id !== enemy.id));
  }

  function handleSaveEnemy(enemy: EnemyDef) {
    const exists = enemies.some((e) => e.id === enemy.id);
    persistEnemies(exists ? enemies.map((e) => (e.id === enemy.id ? enemy : e)) : [...enemies, enemy]);
    setEditingEnemyDef(null);
    clearEnemyDraft();
    setView("enemy-list");
  }

  function handleCancelEnemyEdit() {
    setEditingEnemyDef(null);
    clearEnemyDraft();
    setView("enemy-list");
  }

  function handleEnemyDraftChange(enemy: EnemyDef) {
    setEditingEnemyDef(enemy);
    saveEnemyDraft(enemy);
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
        label: "Enemies",
        items: [
          { label: "New Enemy...", onClick: handleNewEnemy },
          { separator: true },
          { label: "Enemy List", onClick: () => setView("enemy-list") },
        ],
      },
    ],
    [tiles.length, enemies.length]
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
        {view === "enemy-list" && (
          <>
            <h3 className="shmup-editor__heading">Enemy Library ({enemies.length})</h3>
            <EnemyList enemies={enemies} onEdit={handleEditEnemy} onDuplicate={handleDuplicateEnemy} onDelete={handleDeleteEnemy} />
          </>
        )}
        {view === "enemy-edit" && editingEnemyDef && (
          <>
            <h3 className="shmup-editor__heading">{enemies.some((e) => e.id === editingEnemyDef.id) ? "Edit Enemy" : "New Enemy"}</h3>
            <EnemyStatsForm enemy={editingEnemyDef} onSave={handleSaveEnemy} onCancel={handleCancelEnemyEdit} onDraftChange={handleEnemyDraftChange} />
          </>
        )}
        {view === "encounter-edit" && editingTile && editingEncounter && (
          <>
            <h3 className="shmup-editor__heading">
              {editingTile.encounters.some((e) => e.id === editingEncounter.id) ? "Edit Encounter" : "New Encounter"} — {editingTile.name}
            </h3>
            <EncounterEditor
              tile={editingTile}
              enemies={enemies}
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
