import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import {
  DEFAULT_CONFIG, saveGoober, loadGoober, listGoobers, loadGooberSprites,
  type GooberConfig,
} from "./gooberFs";
import { LAYERS } from "./layers";
import "./GooberDressup.css";

interface Props {
  onQuit?: () => void;
  initialFileId?: string;
}

export default function GooberDressup({ onQuit, initialFileId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [config, setConfig] = useState<GooberConfig>(DEFAULT_CONFIG);
  const [activeLayerIdx, setActiveLayerIdx] = useState(0);
  const [loadedSprites, setLoadedSprites] = useState<Map<string, HTMLImageElement[]>>(new Map());
  const [currentFile, setCurrentFile] = useState<{ id: string; name: string } | null>(null);

  const [dialog, setDialog] = useState<"save" | "load" | null>(null);
  const [saveName, setSaveName] = useState("My Goober");
  const [gooberList, setGooberList] = useState<{ id: string; name: string }[]>([]);

  // Load initial file if provided (opened via double-click from FilesApp)
  useEffect(() => {
    if (!initialFileId) return;
    const loaded = loadGoober(initialFileId);
    if (loaded) {
      setConfig(loaded);
      const file = fsStore.getFile(initialFileId);
      if (file) setCurrentFile({ id: initialFileId, name: file.name.replace(/\.DAT$/i, "") });
    }
  }, [initialFileId]);

  // Load sprite images from FS on mount and on FS changes
  useEffect(() => {
    loadGooberSprites().then(setLoadedSprites);
  }, []);
  useEffect(() => {
    return fsStore.subscribe(() => {
      loadGooberSprites().then(setLoadedSprites);
    });
  }, []);

  // Helpers
  function getFrameCount(layerIdx: number): number {
    const layer = LAYERS[layerIdx];
    const imgs = loadedSprites.get(layer.key as string);
    return imgs ? imgs.length : layer.defaultFrameCount;
  }

  function getFrameIdx(layerIdx: number): number {
    const layer = LAYERS[layerIdx];
    const count = getFrameCount(layerIdx);
    return Math.min(config[layer.key], count - 1);
  }

  // Redraw canvas whenever config or sprites change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < LAYERS.length; i++) {
      const layer = LAYERS[i];
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

  // Navigation
  const activeLayer = LAYERS[activeLayerIdx];
  const activeFrameCount = getFrameCount(activeLayerIdx);
  const activeFrameIdx = getFrameIdx(activeLayerIdx);

  const activeFrameName: string = (() => {
    const imgs = loadedSprites.get(activeLayer.key as string);
    if (imgs) return `Frame ${activeFrameIdx + 1}`;
    return activeLayer.names[activeFrameIdx] ?? `Option ${activeFrameIdx + 1}`;
  })();

  function prevFrame() {
    const count = activeFrameCount;
    setConfig(c => ({
      ...c,
      [activeLayer.key]: (c[activeLayer.key] - 1 + count) % count,
    }));
  }

  function nextFrame() {
    const count = activeFrameCount;
    setConfig(c => ({
      ...c,
      [activeLayer.key]: (c[activeLayer.key] + 1) % count,
    }));
  }

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

  // Window menus
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

  const fileName = currentFile ? currentFile.name : "untitled";

  return (
    <div className="goober-dressup">
      {/* Left panel: layer list */}
      <div className="goober-left">
        <div className="goober-left__title">Features</div>
        {LAYERS.map((layer, idx) => (
          <button
            key={layer.key}
            className={`goober-layer-btn${idx === activeLayerIdx ? " goober-layer-btn--active" : ""}`}
            onClick={() => setActiveLayerIdx(idx)}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Right panel: preview + controls */}
      <div className="goober-right">
        <div className="goober-preview">
          <canvas
            ref={canvasRef}
            className="goober-canvas"
            width={280}
            height={280}
          />
        </div>

        <div className="goober-controls">
          <button className="goober-nav-btn" onClick={prevFrame}>&#9664;</button>
          <span className="goober-frame-label">
            {activeFrameName}
            <span className="goober-frame-count">
              {activeFrameIdx + 1}/{activeFrameCount}
            </span>
          </span>
          <button className="goober-nav-btn" onClick={nextFrame}>&#9654;</button>
        </div>

        <div className="goober-layer-label">{activeLayer.label}</div>
      </div>

      {/* Bottom bar */}
      <div className="goober-bottom">
        <span className="goober-filename">
          <span className="goober-filename__label">File:</span>
          <span className="goober-filename__name">{fileName}</span>
        </span>
        <div className="goober-bottom-btns">
          <button className="goober-btn" onClick={handleNew}>New</button>
          <button className="goober-btn" onClick={openSaveDialog}>Save As…</button>
          <button className="goober-btn" onClick={openLoadDialog}>Load…</button>
          <button className="goober-btn" onClick={handleExport}>Export PNG</button>
        </div>
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
