import { useRef } from 'react';
import type { Song, SongBlock } from './types';
import { TRACK_COLORS } from './types';

// ── Layout constants ──────────────────────────────────────────────────────────

export const SONG_LEFT_W = 140; // sticky left panel
export const SONG_BAR_W  = 48;  // pixels per bar in the arrangement
export const SONG_ROW_H  = 36;  // row height
export const SONG_RULER_H = 24; // ruler height

// ── Types ──────────────────────────────────────────────────────────────────────

interface SongViewProps {
  song: Song;
  playheadRef: React.RefObject<HTMLDivElement>;
  onToggleBlock: (clipId: string, bar: number) => void;
  onEditClip: (clipId: string) => void;
  onAddClip: () => void;
  onRemoveClip: (clipId: string) => void;
  onRenameClip: (clipId: string, name: string) => void;
  onRecolorClip: (clipId: string, color: string) => void;
  onChangeArrangementBars: (delta: number) => void;
}

// ── SongView ──────────────────────────────────────────────────────────────────

export default function SongView({
  song, playheadRef,
  onToggleBlock, onEditClip, onAddClip, onRemoveClip,
  onRenameClip, onRecolorClip, onChangeArrangementBars,
}: SongViewProps) {
  const totalW = song.arrangementBars * SONG_BAR_W;
  const editingClipRef = useRef<{ clipId: string; name: string } | null>(null);

  // For each clip, build a lookup: bar → block that covers it (for quick hit-testing)
  function blockAtBar(clipId: string, bar: number): SongBlock | undefined {
    return song.arrangement.find(bl =>
      bl.clipId === clipId && bl.startBar <= bar
    ) && song.arrangement.find(bl => {
      if (bl.clipId !== clipId) return false;
      const clip = song.clips.find(c => c.id === clipId);
      if (!clip) return false;
      return bl.startBar <= bar && bar < bl.startBar + clip.bars;
    });
  }

  return (
    <div className="me-song-outer">
      <div className="me-song-inner" style={{ minWidth: SONG_LEFT_W + totalW }}>

        {/* Ruler — sticky top */}
        <div className="me-song-ruler">
          <div className="me-song-corner" style={{ width: SONG_LEFT_W }}>
            <div className="me-song-length-ctrl">
              <button className="me-btn me-btn--sm" onPointerDown={() => onChangeArrangementBars(-4)} disabled={song.arrangementBars <= 4}>−</button>
              <span className="me-label">{song.arrangementBars} bars</span>
              <button className="me-btn me-btn--sm" onPointerDown={() => onChangeArrangementBars(4)}>+</button>
            </div>
          </div>
          <div className="me-song-ruler-steps" style={{ width: totalW }}>
            {Array.from({ length: song.arrangementBars }, (_, b) => (
              <div
                key={b}
                className="me-song-ruler-mark"
                style={{ left: b * SONG_BAR_W, width: SONG_BAR_W }}
              >
                {b + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Clip rows */}
        {song.clips.map((clip) => {
          const clipBlocks = song.arrangement.filter(bl => bl.clipId === clip.id);

          return (
            <div key={clip.id} className="me-song-row" style={{ height: SONG_ROW_H }}>
              {/* Left panel: clip controls */}
              <div className="me-song-clip-left" style={{ width: SONG_LEFT_W }}>
                <span className="me-track-color-dot" style={{ background: clip.color, cursor: 'pointer' }}
                  onClick={() => {
                    const nextColor = TRACK_COLORS[(TRACK_COLORS.indexOf(clip.color as typeof TRACK_COLORS[number]) + 1) % TRACK_COLORS.length];
                    onRecolorClip(clip.id, nextColor);
                  }}
                  title="Click to change color"
                />
                <input
                  className="me-song-clip-name"
                  value={clip.name}
                  maxLength={16}
                  onChange={e => onRenameClip(clip.id, e.target.value)}
                  onFocus={e => { editingClipRef.current = { clipId: clip.id, name: clip.name }; e.target.select(); }}
                  title="Clip name"
                />
                <div className="me-song-clip-btns">
                  <button className="me-btn me-btn--sm me-btn--edit" onPointerDown={() => onEditClip(clip.id)} title="Edit this clip in Pattern view">EDT</button>
                  {song.clips.length > 1 && (
                    <button className="me-btn me-btn--sm me-btn--danger" onPointerDown={() => onRemoveClip(clip.id)} title="Remove clip">✕</button>
                  )}
                </div>
              </div>

              {/* Arrangement grid for this clip */}
              <div className="me-song-row-grid" style={{ width: totalW, height: SONG_ROW_H }}>
                {/* Background cells */}
                {Array.from({ length: song.arrangementBars }, (_, b) => {
                  const block = blockAtBar(clip.id, b);
                  const isBlockStart = block && block.startBar === b;
                  return (
                    <div
                      key={b}
                      className={`me-song-cell${b % 4 === 0 ? ' me-song-cell--bar4' : ''}${block ? ' me-song-cell--covered' : ''}`}
                      style={{ left: b * SONG_BAR_W, width: SONG_BAR_W, height: SONG_ROW_H }}
                      onPointerDown={e => { e.preventDefault(); onToggleBlock(clip.id, b); }}
                      title={isBlockStart ? `${clip.name} (click to remove)` : block ? `Part of ${clip.name} block` : `Bar ${b + 1}: click to place ${clip.name}`}
                    />
                  );
                })}

                {/* Block visuals — rendered on top */}
                {clipBlocks.map(bl => {
                  const blockW = clip.bars * SONG_BAR_W - 2;
                  return (
                    <div
                      key={bl.id}
                      className="me-song-block"
                      style={{
                        left: bl.startBar * SONG_BAR_W + 1,
                        width: blockW,
                        background: clip.color,
                      }}
                    >
                      <span className="me-song-block-label">{clip.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Add clip row */}
        <div className="me-song-row me-song-add-row">
          <div className="me-song-clip-left" style={{ width: SONG_LEFT_W }}>
            <button
              className="me-btn me-btn--sm"
              onPointerDown={onAddClip}
              disabled={song.clips.length >= 8}
              title="Add a new blank clip"
            >
              + Add Clip
            </button>
          </div>
          <div className="me-song-row-grid me-song-row-grid--empty" style={{ width: totalW }} />
        </div>

        {/* Playhead */}
        <div
          ref={playheadRef}
          className="me-playhead"
          style={{ top: SONG_RULER_H, display: 'none' }}
        />

        {/* Clip index labels for reference */}
        {song.clips.length > 1 && (
          <div className="me-song-legend">
            {song.clips.map((clip, i) => (
              <span key={clip.id} className="me-song-legend-item">
                <span className="me-song-legend-dot" style={{ background: clip.color }} />
                {String.fromCharCode(65 + i)} = {clip.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
