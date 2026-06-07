import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { Tabs } from "../../components/Tabs/Tabs";
import type { TabItem } from "../../components/Tabs/Tabs";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import {
  DEFAULT_CONFIG, saveGoober, loadGoober, listGoobers, loadGooberSprites,
  type GooberConfig,
} from "./gooberFs";
import { LAYERS, type LayerDef } from "./layers";
import "./GooberDressup.css";

interface Props {
  onQuit?: () => void;
  initialFileId?: string;
}

const TABS: TabItem[] = LAYERS.map(l => ({ id: l.key as string, label: l.label }));

// ── Mini option preview ───────────────────────────────────────────────────────

function MiniPreview({
  layer,
  frameIdx,
  loadedImages,
}: {
  layer: LayerDef;
  frameIdx: number;
  loadedImages: HTMLImageElement[] | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, size, size);
    const img = loadedImages?.[frameIdx];
    if (img) {
      ctx.drawImage(img, 0, 0, size, size);
    } else {
      layer.drawFrame(ctx, frameIdx, size);
    }
  }, [layer, frameIdx, loadedImages]);

  return <canvas ref={canvasRef} width={72} height={72} className="goober-mini-canvas" />;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GooberDressup({ onQuit, initialFileId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [config, setConfig] = useState<GooberConfig>(DEFAULT_CONFIG);
  const [activeTabKey, setActiveTabKey] = useState<string>(LAYERS[0].key as string);
  const [loadedSprites, setLoadedSprites] = useState<Map<string, HTMLImageElement[]>>(new Map());
  const [currentFile, setCurrentFile] = useState<{ id: string; name: string } | null>(null);

  const [dialog, setDialog] = useState<"save" | "load" | null>(null);
  const [saveName, setSaveName] = useState("My Goober");
  const [gooberList, setGooberList] = useState<{ id: string; name: string }[]>([]);

  // Load initial file (opened via double-click from FilesApp)
  useEffect(() => {
    if (!initialFileId) return;
    const loaded = loadGoober(initialFileId);
    if (loaded) {
      setConfig(loaded);
      const file = fsStore.getFile(initialFileId);
      if (file) setCurrentFile({ id: initialFileId, name: file.name.replace(/\.DAT$/i, "") });
    }
  }, [initialFileId]);

  // Load sprites on mount; reload on FS changes
  useEffect(() => {
    loadGooberSprites().then(setLoadedSprites);
  }, []);
  useEffect(() => {
    return fsStore.subscribe(() => {
      loadGooberSprites().then(setLoadedSprites);
    });
  }, []);

  // Redraw full preview whenever config or sprites change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    for (const layer of LAYERS) {
      const imgs = loadedSprites.get(layer.key as string);
      const count = imgs ? imgs.length : layer.defaultFrameCount;
      const frameIdx = Math.min(config[layer.key], count - 1);
      if (imgs && imgs[frameIdx]) {
        ctx.drawImage(imgs[frameIdx], 0, 0, size, size);
      } else {
        layer.drawFrame(ctx, frameIdx, size);
      }
    }
  }, [config, loadedSprites]);

  // Active layer
  const activeLayerDef: LayerDef = LAYERS.find(l => (l.key as string) === activeTabKey) ?? LAYERS[0];
  const activeImgs = loadedSprites.get(activeTabKey);
  const frameCount = activeImgs ? activeImgs.length : activeLayerDef.defaultFrameCount;

  // File operations
  const handleNew = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setCurrentFile(null);
  }, []);

  const openSaveDialog = useCallback(() => {
    setSaveName(currentFile?.name ?? "My Goober");
    setDialog("save");
  }, [currentFile]);

  const openLoadDialog = useCallback(() => {
    setGooberList(listGoobers());
    setDialog("load");
  }, []);

  function confirmSave() {
    const name = saveName.trim();
    if (!name) return;
    saveGoober(name, config);
    const updated = listGoobers();
    const saved = updated.find(g => g.name.toLowerCase() === name.toLowerCase());
    if (saved) setCurrentFile(saved);
    setDialog(null);
  }

  function confirmLoad(fileId: string) {
    const loaded = loadGoober(fileId);
    if (!loaded) return;
    setConfig(loaded);
    const entry = gooberList.find(g => g.id === fileId);
    if (entry) setCurrentFile(entry);
    setDialog(null);
  }

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = (currentFile?.name ?? "goober") + ".png";
    a.click();
  }, [currentFile]);

  const menus = useMemo<MenuBarMenu[]>(() => {
    const quitItems: MenuBarMenu["items"] = onQuit
      ? [{ separator: true }, { label: "Quit", onClick: onQuit }]
      : [];
    return [
      {
        label: "File",
        items: [
          { label: "New Goober", onClick: handleNew },
          { separator: true },
          { label: "Save As...", onClick: openSaveDialog },
          { label: "Load Goober...", onClick: openLoadDialog },
          { separator: true },
          { label: "Export as PNG...", onClick: handleExport },
          ...quitItems,
        ],
      },
    ];
  }, [onQuit, handleNew, openSaveDialog, openLoadDialog, handleExport]);

  useWindowMenus(menus);

  return (
    <div className="goober-dressup">

      {/* Full preview at top */}
      <div className="goober-preview-area">
        <div className="goober-preview-wrapper">
          <canvas ref={canvasRef} width={256} height={256} className="goober-canvas" />
        </div>
        <div className="goober-preview-caption">
          {currentFile ? currentFile.name : "untitled"}
        </div>
      </div>

      {/* Feature tabs */}
      <Tabs
        tabs={TABS}
        activeTab={activeTabKey}
        onTabChange={setActiveTabKey}
      />

      {/* Option grid — fills remaining space */}
      <div className="goober-options">
        {Array.from({ length: frameCount }, (_, i) => {
          const name = activeImgs
            ? `Frame ${i + 1}`
            : (activeLayerDef.names[i] ?? `Option ${i + 1}`);
          const isSelected = config[activeLayerDef.key] === i;
          return (
            <button
              key={i}
              className={`goober-option-btn${isSelected ? " goober-option-btn--selected" : ""}`}
              onClick={() => setConfig(c => ({ ...c, [activeLayerDef.key]: i } as GooberConfig))}
              title={name}
            >
              <MiniPreview
                layer={activeLayerDef}
                frameIdx={i}
                loadedImages={activeImgs}
              />
              <span className="goober-option-label">{name}</span>
            </button>
          );
        })}
      </div>

      {/* Save As dialog */}
      {dialog === "save" && (
        <div className="goober-dialog-overlay" onClick={() => setDialog(null)}>
          <div className="goober-dialog" onClick={e => e.stopPropagation()}>
            <div className="goober-dialog__titlebar">
              <span>Save Goober As</span>
              <button className="goober-dialog__close" onClick={() => setDialog(null)}>✕</button>
            </div>
            <div className="goober-dialog__body">
              <label className="goober-dialog__label">Name:</label>
              <input
                className="goober-dialog__input"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmSave()}
                autoFocus
                maxLength={32}
              />
            </div>
            <div className="goober-dialog__btns">
              <button className="goober-btn goober-btn--primary" onClick={confirmSave}>Save</button>
              <button className="goober-btn" onClick={() => setDialog(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Load dialog */}
      {dialog === "load" && (
        <div className="goober-dialog-overlay" onClick={() => setDialog(null)}>
          <div className="goober-dialog" onClick={e => e.stopPropagation()}>
            <div className="goober-dialog__titlebar">
              <span>Load Goober</span>
              <button className="goober-dialog__close" onClick={() => setDialog(null)}>✕</button>
            </div>
            <div className="goober-dialog__body goober-dialog__body--list">
              {gooberList.length === 0 ? (
                <div className="goober-dialog__empty">No saved Goobers yet.</div>
              ) : (
                gooberList.map(g => (
                  <button
                    key={g.id}
                    className="goober-dialog__file-btn"
                    onClick={() => confirmLoad(g.id)}
                  >
                    💾 {g.name}
                  </button>
                ))
              )}
            </div>
            <div className="goober-dialog__btns">
              <button className="goober-btn" onClick={() => setDialog(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
