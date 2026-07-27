import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import TileArt from "./TileArt";
import type { Orientation } from "./orientation";
import { buildTagGraph, preservePositions, stepSimulation, tilesForEdge, tilesForTag, type TagGraphData } from "./tagGraph";
import type { TileDef } from "./types";

interface TagGraphProps {
  tiles: TileDef[];
  onEditTile: (tile: TileDef) => void;
}

type Selection = { kind: "node"; tag: string } | { kind: "edge"; a: string; b: string } | null;

const IDENTITY: Orientation = { rotation: 0, flip: false };
const CANVAS_HEIGHT = 380;
const EDGE_HIT_DISTANCE = 8;

function nodeRadius(count: number): number {
  return Math.min(28, 8 + Math.sqrt(count) * 5);
}

function edgeWidth(count: number): number {
  return Math.min(10, 1 + Math.sqrt(count) * 1.8);
}

/** Shortest distance from point (px,py) to segment (x1,y1)-(x2,y2). */
function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export default function TagGraph({ tiles, onEditTile }: TagGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Lazy-initialized inline (not via useRef's argument, which JS evaluates
  // on every render even though only the first render's result is kept) —
  // this is the standard "expensive ref init" pattern, avoiding rebuilding
  // the whole graph from `tiles` on every unrelated re-render (e.g. a click
  // that only changes `selection`).
  const graphRef = useRef<TagGraphData>(null!);
  if (!graphRef.current) graphRef.current = buildTagGraph(tiles);

  const draggingRef = useRef<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  // Kept in sync SYNCHRONOUSLY at every setSelection call site (via
  // selectSync below), not through a separate `useEffect([selection])` —
  // that would lag one render behind, so the still-animating draw() loop
  // could paint a just-made click as unselected for a frame.
  const selectionRef = useRef<Selection>(null);

  function selectSync(next: Selection) {
    selectionRef.current = next;
    setSelection(next);
  }

  // Rebuild graph data whenever the library changes, preserving existing
  // node positions so the layout doesn't jump around on every edit.
  useEffect(() => {
    const next = preservePositions(buildTagGraph(tiles), graphRef.current);
    graphRef.current = next;
    setSelection((prev) => {
      if (!prev) return prev;
      const stillValid =
        prev.kind === "node"
          ? next.nodes.some((n) => n.tag === prev.tag)
          : next.edges.some((e) => (e.a === prev.a && e.b === prev.b) || (e.a === prev.b && e.b === prev.a));
      const resolved = stillValid ? prev : null;
      selectionRef.current = resolved;
      return resolved;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

  // Keep the canvas's pixel size matched to its displayed width.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = CANVAS_HEIGHT;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // The physics + draw loop. Runs continuously while this view is open —
  // node/edge counts here are small (tens/hundreds), so the cost is trivial.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;

    function draw() {
      const graph = graphRef.current;
      const width = canvas!.width;
      const height = canvas!.height;
      stepSimulation(graph, width, height, draggingRef.current);

      ctx!.clearRect(0, 0, width, height);
      ctx!.fillStyle = "#180800";
      ctx!.fillRect(0, 0, width, height);

      const sel = selectionRef.current;

      for (const edge of graph.edges) {
        const a = graph.nodes[graph.indexOf.get(edge.a)!];
        const b = graph.nodes[graph.indexOf.get(edge.b)!];
        if (!a || !b) continue;
        const isSelected = sel?.kind === "edge" && ((sel.a === edge.a && sel.b === edge.b) || (sel.a === edge.b && sel.b === edge.a));
        ctx!.strokeStyle = isSelected ? "#ff6b00" : "#7b3dbe";
        ctx!.globalAlpha = isSelected ? 1 : 0.55;
        ctx!.lineWidth = edgeWidth(edge.count);
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;

      for (const node of graph.nodes) {
        const isSelected = sel?.kind === "node" && sel.tag === node.tag;
        const r = nodeRadius(node.count);
        ctx!.fillStyle = isSelected ? "#ff6b00" : "#cc4400";
        ctx!.strokeStyle = "#ffcc88";
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.stroke();

        ctx!.fillStyle = "#fff";
        ctx!.font = "7px 'Press Start 2P', monospace";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "top";
        ctx!.fillText(node.tag, node.x, node.y + r + 3);
      }

      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  function localPoint(e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const { x, y } = localPoint(e);
    const graph = graphRef.current;

    for (const node of graph.nodes) {
      if (Math.hypot(node.x - x, node.y - y) <= nodeRadius(node.count)) {
        selectSync({ kind: "node", tag: node.tag });
        draggingRef.current = node.tag;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    let closestEdge: { a: string; b: string } | null = null;
    let closestDist = EDGE_HIT_DISTANCE;
    for (const edge of graph.edges) {
      const a = graph.nodes[graph.indexOf.get(edge.a)!];
      const b = graph.nodes[graph.indexOf.get(edge.b)!];
      if (!a || !b) continue;
      const dist = distanceToSegment(x, y, a.x, a.y, b.x, b.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestEdge = { a: edge.a, b: edge.b };
      }
    }
    selectSync(closestEdge ? { kind: "edge", ...closestEdge } : null);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) return;
    const { x, y } = localPoint(e);
    const node = graphRef.current.nodes.find((n) => n.tag === draggingRef.current);
    if (node) {
      node.x = x;
      node.y = y;
    }
  }

  function handlePointerUp() {
    draggingRef.current = null;
  }

  const matchingTiles = useMemo(() => {
    if (!selection) return [];
    return selection.kind === "node" ? tilesForTag(tiles, selection.tag) : tilesForEdge(tiles, selection.a, selection.b);
  }, [selection, tiles]);

  if (tiles.length === 0) {
    return <p className="shmup-hint">Create at least one tile to see its tag graph.</p>;
  }
  if (graphRef.current.nodes.length === 0) {
    return <p className="shmup-hint">No real edge tags yet — every tile is Hard Wall on every side.</p>;
  }

  return (
    <div className="shmup-tag-graph">
      <p className="shmup-hint">
        Each tag is a node; a connection exists wherever a tile carries both tags. Node size and line thickness reflect how many
        tiles contribute. Tap a tag or connection to see its tiles; drag tags to rearrange.
      </p>
      <div className="shmup-tag-graph__canvas-wrap" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="shmup-tag-graph__canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      {selection && (
        <div className="shmup-tag-graph__panel">
          <h4 className="shmup-tag-graph__panel-title">
            {selection.kind === "node" ? selection.tag : `${selection.a} ↔ ${selection.b}`}
          </h4>
          {matchingTiles.length === 0 ? (
            <p className="shmup-hint">No tiles match anymore — try reselecting.</p>
          ) : (
            <div className="shmup-tile-picker">
              {matchingTiles.map((tile) => (
                <button key={tile.id} type="button" className="shmup-tile-picker__option" onClick={() => onEditTile(tile)} title={tile.name}>
                  <TileArt tile={tile} orientation={IDENTITY} size="thumb" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
