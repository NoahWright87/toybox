import { useMemo, useState } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import TileList from "./TileList";
import TileEditorForm from "./TileEditorForm";
import ConnectionTester from "./ConnectionTester";
import { loadTiles, saveTiles } from "./tileStore";
import { collectUsedTags } from "./tagRegistry";
import { createBlankTile, makeTileId, type TileDef } from "./types";
import "./ShmupEditor.css";

type View = "list" | "edit" | "connections";

export default function ShmupEditor() {
  const [tiles, setTiles] = useState<TileDef[]>(() => loadTiles());
  const [view, setView] = useState<View>("list");
  const [editingTile, setEditingTile] = useState<TileDef | null>(null);
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
    setView("edit");
  }

  function handleEditTile(tile: TileDef) {
    setEditingTile(tile);
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
    setView("list");
  }

  function handleCancelEdit() {
    setEditingTile(null);
    setView("list");
  }

  const menus = useMemo<MenuBarMenu[]>(
    () => [
      {
        label: "Tiles",
        items: [
          { label: "New Tile...", onClick: handleNewTile },
          { separator: true },
          { label: "Tile List", onClick: () => setView("list") },
          { label: "Connection Tester", onClick: () => setView("connections") },
        ],
      },
    ],
    [tiles.length]
  );
  useWindowMenus(menus);

  return (
    <div className="shmup-editor">
      <div className="shmup-editor__tabs">
        <button
          type="button"
          className={`shmup-btn ${view === "list" ? "shmup-btn--active" : ""}`}
          onClick={() => setView("list")}
        >
          Tiles ({tiles.length})
        </button>
        <button type="button" className="shmup-btn" onClick={handleNewTile}>
          + New Tile
        </button>
        <button
          type="button"
          className={`shmup-btn ${view === "connections" ? "shmup-btn--active" : ""}`}
          onClick={() => setView("connections")}
        >
          Connection Tester
        </button>
      </div>

      <div className="shmup-editor__body">
        {view === "list" && (
          <TileList tiles={tiles} onEdit={handleEditTile} onDuplicate={handleDuplicateTile} onDelete={handleDeleteTile} />
        )}
        {view === "edit" && editingTile && (
          <TileEditorForm
            tile={editingTile}
            availableTags={availableTags}
            onRegisterTag={registerTag}
            onSave={handleSaveTile}
            onCancel={handleCancelEdit}
          />
        )}
        {view === "connections" && <ConnectionTester tiles={tiles} />}
      </div>
    </div>
  );
}
