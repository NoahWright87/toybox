import { useState, useRef, useCallback, useEffect } from 'react';
import {
  generateMap,
  GEN_WALL,
  GEN_KEY_COLORS,
  type LayerConfig, type MapGenParams, type MapGenResult, type Topology,
} from './mapgen';
import { ROOM_TYPES_META } from './mapgenMeta';
import './HellMapEditor.css';

const MAX_LAYERS = 7;
const DEFAULT_COLORS = ['#ffffff', '#e05040', '#e08830', '#d4c040', '#50a850', '#4888e0', '#9050d0'];
const TOPOS: Topology[] = ['drunken', 'random', 'linear', 'grid', 'spiral'];

function defaultLayer(idx: number): LayerConfig {
  return { color: DEFAULT_COLORS[idx] || '#888888', topo: 'drunken', rooms: 12, randomStart: idx > 0 };
}

export default function HellMapEditor() {
  const [gridSize, setGridSize] = useState(128);
  const [extraDoors, setExtraDoors] = useState(30);
  const [roomAvg, setRoomAvg] = useState(7);
  const [roomVar, setRoomVar] = useState(3);
  const [secTreasure, setSecTreasure] = useState(3);
  const [secShortcut, setSecShortcut] = useState(2);
  const [layers, setLayers] = useState<LayerConfig[]>([defaultLayer(0), defaultLayer(1)]);
  const [status, setStatus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<MapGenResult | null>(null);
  const debugRef = useRef<HTMLDivElement>(null);

  const addLayer = useCallback(() => {
    if (layers.length >= MAX_LAYERS) return;
    setLayers(prev => [...prev, defaultLayer(prev.length)]);
  }, [layers.length]);

  const removeLayer = useCallback((idx: number) => {
    if (layers.length <= 1) return;
    setLayers(prev => prev.filter((_, i) => i !== idx));
  }, [layers.length]);

  const updateLayer = useCallback((idx: number, patch: Partial<LayerConfig>) => {
    setLayers(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }, []);

  const renderResult = useCallback((result: MapGenResult) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const SIZE = result.size;
    const TILE_PX = Math.max(3, Math.floor(Math.min(900, 700) / SIZE));
    canvas.width = SIZE * TILE_PX;
    canvas.height = SIZE * TILE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background (walls)
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Build room index for coloring
    const tileRoomIdx = new Map<number, number>(); // tile index -> room index
    for (let ri = 0; ri < result.rooms.length; ri++) {
      const r = result.rooms[ri];
      for (let ry = r.y1; ry < r.y2; ry++) {
        for (let rx = r.x1; rx < r.x2; rx++) {
          const t = result.tiles[ry * SIZE + rx];
          if (t !== GEN_WALL) tileRoomIdx.set(ry * SIZE + rx, ri);
        }
      }
    }

    // Build door color map
    const doorColors = new Map<number, string>(); // tile index -> color
    const hiddenDoorSet = new Set<number>();
    for (const d of result.doors) {
      const tIdx = d.y * SIZE + d.x;
      doorColors.set(tIdx, GEN_KEY_COLORS[d.layerIdx] || '#ffffff');
      if (d.isHidden) hiddenDoorSet.add(tIdx);
    }

    // Draw floor tiles
    for (let ri = 0; ri < result.rooms.length; ri++) {
      const room = result.rooms[ri];
      let col: string;
      if (room.isStart) col = '#e8e07a';
      else if (room.isExit) col = '#d9704a';
      else if (room.isKey) col = GEN_KEY_COLORS[room.layerIdx + 1] || '#aaaaaa';
      else col = '#c8a96e';
      ctx.fillStyle = col;
      for (let ry = room.y1; ry < room.y2; ry++) {
        for (let rx = room.x1; rx < room.x2; rx++) {
          const t = result.tiles[ry * SIZE + rx];
          if (t !== GEN_WALL) ctx.fillRect(rx * TILE_PX, ry * TILE_PX, TILE_PX, TILE_PX);
        }
      }
    }

    // Draw door tiles
    for (const [tIdx, color] of doorColors) {
      if (hiddenDoorSet.has(tIdx)) continue; // hidden doors look like walls
      const dx = tIdx % SIZE, dy = Math.floor(tIdx / SIZE);
      ctx.fillStyle = color;
      ctx.fillRect(dx * TILE_PX, dy * TILE_PX, TILE_PX, TILE_PX);
    }

    // Subtle grid
    if (TILE_PX >= 5) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      for (let ti = 0; ti < result.tiles.length; ti++) {
        if (result.tiles[ti] > GEN_WALL) {
          const tx = ti % SIZE, ty = Math.floor(ti / SIZE);
          ctx.strokeRect(tx * TILE_PX + 0.5, ty * TILE_PX + 0.5, TILE_PX - 1, TILE_PX - 1);
        }
      }
    }

    // Room outlines
    if (TILE_PX >= 3) {
      const ow = Math.max(1, Math.floor(TILE_PX / 4));
      ctx.lineWidth = ow;
      ctx.lineCap = 'square';
      for (const room of result.rooms) {
        if (room.isSecret) {
          ctx.setLineDash([TILE_PX, TILE_PX]);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = GEN_KEY_COLORS[room.layerIdx] || '#ffffff';
        }
        // Stroke per-tile edges
        ctx.beginPath();
        for (let ry = room.y1; ry < room.y2; ry++) {
          for (let rx = room.x1; rx < room.x2; rx++) {
            const t = result.tiles[ry * SIZE + rx];
            if (t === GEN_WALL) continue;
            const px = rx * TILE_PX, py = ry * TILE_PX;
            const tN = ry > 0 ? result.tiles[(ry - 1) * SIZE + rx] : GEN_WALL;
            const tE = rx < SIZE - 1 ? result.tiles[ry * SIZE + rx + 1] : GEN_WALL;
            const tS = ry < SIZE - 1 ? result.tiles[(ry + 1) * SIZE + rx] : GEN_WALL;
            const tW = rx > 0 ? result.tiles[ry * SIZE + rx - 1] : GEN_WALL;
            // Only draw borders against walls (not adjacent floor of same room)
            if (tN === GEN_WALL) { ctx.moveTo(px, py + ow / 2); ctx.lineTo(px + TILE_PX, py + ow / 2); }
            if (tE === GEN_WALL) { ctx.moveTo(px + TILE_PX - ow / 2, py); ctx.lineTo(px + TILE_PX - ow / 2, py + TILE_PX); }
            if (tS === GEN_WALL) { ctx.moveTo(px, py + TILE_PX - ow / 2); ctx.lineTo(px + TILE_PX, py + TILE_PX - ow / 2); }
            if (tW === GEN_WALL) { ctx.moveTo(px + ow / 2, py); ctx.lineTo(px + ow / 2, py + TILE_PX); }
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Emojis + trap locks
    if (TILE_PX >= 4) {
      const emojiSize = Math.max(8, Math.min(20, TILE_PX * 2.5));
      ctx.font = `${emojiSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const room of result.rooms) {
        const meta = ROOM_TYPES_META[room.isKey ? 'key' : room.isStart ? 'start' : room.isExit ? 'exit' : room.roomType];
        const emoji = meta ? meta.emoji : null;
        if (emoji) {
          ctx.fillText(emoji, room.cx * TILE_PX + TILE_PX / 2, room.cy * TILE_PX + TILE_PX / 2);
        }
        if (room.isTrap) {
          const smallSize = Math.max(6, Math.floor(emojiSize * 0.6));
          ctx.font = `${smallSize}px serif`;
          ctx.fillText('🔒', room.cx * TILE_PX + TILE_PX / 2 + Math.floor(emojiSize * 0.5), room.cy * TILE_PX + TILE_PX / 2 - Math.floor(emojiSize * 0.5));
          ctx.font = `${emojiSize}px serif`;
        }
      }
    }
  }, []);

  const generate = useCallback(() => {
    setGenerating(true);
    setDebugLines([]);
    const seed = Math.floor(Math.random() * 0xFFFFFF);
    const params: MapGenParams = {
      seed,
      size: gridSize,
      extraDoorsPct: extraDoors / 100,
      roomAvg,
      roomVariance: roomVar,
      layers,
      secretTreasure: secTreasure,
      secretShortcut: secShortcut,
    };

    // Run synchronously in next tick so UI updates first
    requestAnimationFrame(() => {
      try {
        const result = generateMap(params);
        resultRef.current = result;
        renderResult(result);

        const floors = result.tiles.filter(t => t !== GEN_WALL).length;
        const doorCount = result.doors.filter(d => !d.isHidden).length;
        setStatus(
          `seed:${seed.toString(16).padStart(6, '0')} · ${result.rooms.length} rooms · ${floors} floor tiles · ${doorCount} doors · ${layers.length} layers`
        );

        const lines: string[] = [
          `seed: ${seed.toString(16)} | size: ${gridSize}×${gridSize} | layers: ${layers.length}`,
        ];
        for (let li = 0; li < layers.length; li++) {
          const layerRooms = result.rooms.filter(r => r.layerIdx === li);
          const keyRooms = layerRooms.filter(r => r.isKey);
          lines.push(`  layer ${li} (${layers[li].topo}): ${layerRooms.length} rooms${keyRooms.length ? ' | key room: #' + keyRooms[0].id : ''}`);
        }
        const secrets = result.rooms.filter(r => r.isSecret);
        if (secrets.length) lines.push(`  secrets: ${secrets.length} (${result.doors.filter(d => d.isHidden).length} hidden doors)`);
        setDebugLines(lines);
      } catch (e) {
        setStatus('Generation error — see console');
        console.error(e);
      }
      setGenerating(false);
    });
  }, [gridSize, extraDoors, roomAvg, roomVar, layers, secTreasure, secShortcut, renderResult]);

  // Auto-scroll debug log
  useEffect(() => {
    if (debugRef.current) debugRef.current.scrollTop = debugRef.current.scrollHeight;
  }, [debugLines]);

  // Generate on mount
  useEffect(() => { generate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="hme-root">
      <div className="hme-sidebar">
        <div className="hme-title">// hell map generator</div>

        <div className="hme-panel">
          <div className="hme-panel-title">// global</div>
          <div className="hme-grid2">
            <label>grid size</label>
            <select value={gridSize} onChange={e => setGridSize(Number(e.target.value))}>
              {[64, 96, 128, 192, 256].map(s => <option key={s} value={s}>{s}×{s}</option>)}
            </select>
            <label>extra doors %</label>
            <input type="number" value={extraDoors} min={0} max={100} onChange={e => setExtraDoors(Number(e.target.value))} />
            <label>room size avg</label>
            <input type="number" value={roomAvg} min={3} max={20} onChange={e => setRoomAvg(Number(e.target.value))} />
            <label>room size variance</label>
            <input type="number" value={roomVar} min={0} max={10} onChange={e => setRoomVar(Number(e.target.value))} />
          </div>
        </div>

        <div className="hme-panel">
          <div className="hme-panel-title">// layers</div>
          <div className="hme-col-header">
            <span>key</span><span>topology</span><span>rooms</span><span>rand</span><span></span>
          </div>
          {layers.map((layer, idx) => (
            <div key={idx} className="hme-layer-row">
              <div className="hme-swatch" style={{ background: layer.color, opacity: idx === 0 ? 0.5 : 1 }}>
                {idx !== 0 && (
                  <input
                    type="color"
                    value={layer.color}
                    onChange={e => updateLayer(idx, { color: e.target.value })}
                    className="hme-color-input"
                  />
                )}
              </div>
              <select value={layer.topo} onChange={e => updateLayer(idx, { topo: e.target.value as Topology })}>
                {TOPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="number"
                value={layer.rooms}
                min={2}
                max={60}
                onChange={e => updateLayer(idx, { rooms: Math.max(2, Math.min(60, Number(e.target.value))) })}
              />
              <input
                type="checkbox"
                checked={layer.randomStart}
                disabled={idx === 0}
                onChange={e => updateLayer(idx, { randomStart: e.target.checked })}
              />
              <button
                className="hme-rm-btn"
                onClick={() => removeLayer(idx)}
                disabled={idx === 0 || layers.length <= 1}
              >×</button>
            </div>
          ))}
          {layers.length < MAX_LAYERS && (
            <button className="hme-add-layer-btn" onClick={addLayer}>+ add layer</button>
          )}
        </div>

        <button className="hme-gen-btn" onClick={generate} disabled={generating}>
          {generating ? '⟳ generating…' : '⟳ generate'}
        </button>

        <div className="hme-panel">
          <div className="hme-panel-title">// secret rooms</div>
          <div className="hme-grid2">
            <label>treasure secrets</label>
            <input type="number" value={secTreasure} min={0} max={20} onChange={e => setSecTreasure(Number(e.target.value))} />
            <label>shortcut secrets</label>
            <input type="number" value={secShortcut} min={0} max={20} onChange={e => setSecShortcut(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="hme-main">
        <div className="hme-status">{status}</div>
        <div className="hme-canvas-wrap">
          <canvas ref={canvasRef} />
        </div>
        <div className="hme-legend">
          <span className="hme-leg"><span className="hme-sw" style={{ background: '#111', border: '1px solid #333' }} />wall</span>
          <span className="hme-leg"><span className="hme-sw" style={{ background: '#c8a96e' }} />floor</span>
          <span className="hme-leg"><span className="hme-sw" style={{ background: '#e8e07a' }} />start</span>
          <span className="hme-leg"><span className="hme-sw" style={{ background: '#d9704a' }} />exit</span>
          <span className="hme-leg"><span className="hme-sw" style={{ background: '#888' }} />door</span>
        </div>
        <div className="hme-debug-wrap">
          <div className="hme-debug-title">
            // debug
            <button className="hme-debug-clear" onClick={() => setDebugLines([])}>clear</button>
          </div>
          <div className="hme-debug-log" ref={debugRef}>
            {debugLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
