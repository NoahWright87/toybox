import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useWindowMenus } from '../../components/Window/useWindowMenus';
import type { MenuBarMenu } from '../../components/MenuBar/MenuBar';
import {
  type Pattern, type Track, type Note, type DrumType, type OscWaveform,
  DRUM_TYPES, DRUM_LABELS, DRUM_PITCHES, PIANO_MIN, PIANO_MAX,
  isBlackPitch, pitchName, makeNoteId, createInitialPattern, TRACK_COLORS,
} from './types';
import { resumeAudio, playNote, playDrum } from './audio';
import './MidiEditor.css';

// ── Layout & zoom constants ────────────────────────────────────────────────────

const ZOOM_PRESETS = [
  { stepW: 14, rowH: 10 },
  { stepW: 18, rowH: 13 },
  { stepW: 24, rowH: 16 },   // default
  { stepW: 32, rowH: 22 },
  { stepW: 44, rowH: 30 },
] as const;
const DEFAULT_ZOOM = 2;

const LEFT_W  = 100; // sticky left sidebar (track controls + piano keys)
const KEYS_W  = 40;  // piano keys / drum labels within the sidebar
const RULER_H = 24;  // time ruler row height
const HDR_H   = 32;  // track header row height

const PITCH_RANGE: number[] = [];
for (let p = PIANO_MAX; p >= PIANO_MIN; p--) PITCH_RANGE.push(p);

const PITCH_TO_ROW = new Map<number, number>();
PITCH_RANGE.forEach((p, i) => PITCH_TO_ROW.set(p, i));

// ── Types ──────────────────────────────────────────────────────────────────────

type PaintState = { action: 'add' | 'remove'; trackId: string } | null;
type ResizeState = { noteId: string; trackId: string; startX: number; origDuration: number; noteStartStep: number };

interface SaveEntry { name: string; pattern: Pattern; savedAt: string }

// ── Storage helpers ────────────────────────────────────────────────────────────

const STORAGE_AUTO = 'midi-editor-pattern';
const STORAGE_SAVES = 'midi-editor-saves';
const STORAGE_ZOOM  = 'midi-editor-zoom';

function migrateTrack(t: Track): Track {
  const defaults = { volume: 1, attack: 0.01, release: 0.3, collapsed: false };
  return { ...defaults, ...t };
}

function migratePattern(raw: unknown): Pattern {
  const p = raw as Pattern;
  return { ...p, tracks: p.tracks.map(migrateTrack) };
}

function loadPattern(): Pattern {
  try {
    const raw = localStorage.getItem(STORAGE_AUTO);
    if (raw) return migratePattern(JSON.parse(raw));
  } catch { /* ignore */ }
  return createInitialPattern();
}

function loadZoomIdx(): number {
  try { return Number(localStorage.getItem(STORAGE_ZOOM)) || DEFAULT_ZOOM; } catch { return DEFAULT_ZOOM; }
}

function getSaves(): SaveEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_SAVES) || '[]'); } catch { return []; }
}

function persistSave(name: string, pattern: Pattern) {
  const saves = getSaves().filter(s => s.name !== name);
  saves.unshift({ name, pattern, savedAt: new Date().toISOString() });
  try { localStorage.setItem(STORAGE_SAVES, JSON.stringify(saves.slice(0, 20))); } catch { /* ignore */ }
}

function deleteSave(name: string) {
  const saves = getSaves().filter(s => s.name !== name);
  try { localStorage.setItem(STORAGE_SAVES, JSON.stringify(saves)); } catch { /* ignore */ }
}

function downloadJson(pattern: Pattern) {
  const blob = new Blob([JSON.stringify(pattern, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'midi-pattern.json'; a.click();
  URL.revokeObjectURL(url);
}

// ── Build note map (pitch,step → noteId) ──────────────────────────────────────

function buildNoteMap(track: Track): Map<string, string> {
  const m = new Map<string, string>();
  track.notes.forEach(n => {
    for (let d = 0; d < n.durationSteps; d++) m.set(`${n.pitch},${n.startStep + d}`, n.id);
  });
  return m;
}

// ── Instrument modal ───────────────────────────────────────────────────────────

interface InstrumentModalProps {
  track: Track;
  onSave: (updates: Partial<Track>) => void;
  onClose: () => void;
}

function InstrumentModal({ track, onSave, onClose }: InstrumentModalProps) {
  const [name,     setName]     = useState(track.name);
  const [color,    setColor]    = useState(track.color);
  const [waveform, setWaveform] = useState(track.waveform);
  const [volume,   setVolume]   = useState(Math.round(track.volume * 100));

  function save() { onSave({ name, color, waveform, volume: volume / 100 }); }

  return (
    <div className="me-modal-backdrop" onPointerDown={onClose}>
      <div className="me-modal" onPointerDown={e => e.stopPropagation()}>
        <div className="me-modal__title">
          <span>⚙ Track Settings</span>
          <button className="me-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="me-modal__body">
          <div className="me-modal__row">
            <label className="me-label">NAME</label>
            <input
              className="me-text-input"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={16}
            />
          </div>

          <div className="me-modal__row">
            <label className="me-label">COLOR</label>
            <div className="me-color-swatches">
              {TRACK_COLORS.map(c => (
                <button
                  key={c}
                  className={`me-color-swatch${c === color ? ' me-color-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {!track.isDrum && (
            <div className="me-modal__row">
              <label className="me-label">SYNTH</label>
              <select
                className="me-select"
                value={waveform}
                onChange={e => setWaveform(e.target.value as OscWaveform)}
              >
                <option value="sine">Sine</option>
                <option value="triangle">Triangle</option>
                <option value="square">Square</option>
                <option value="sawtooth">Sawtooth</option>
              </select>
            </div>
          )}

          <div className="me-modal__row">
            <label className="me-label">VOL {volume}%</label>
            <input
              type="range" min={0} max={100} value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="me-slider"
            />
          </div>

          <div className="me-modal__row me-modal__row--dim">
            <label className="me-label">SOUND</label>
            <span className="me-label me-label--dim">Upload sample (coming soon)</span>
          </div>
        </div>

        <div className="me-modal__footer">
          <button className="me-btn" onClick={onClose}>Cancel</button>
          <button className="me-btn me-btn--primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Save / Load dialogs ────────────────────────────────────────────────────────

interface SaveDialogProps { onSave: (name: string) => void; onClose: () => void }

function SaveDialog({ onSave, onClose }: SaveDialogProps) {
  const [name, setName] = useState('My Pattern');
  const saves = getSaves();
  return (
    <div className="me-modal-backdrop" onPointerDown={onClose}>
      <div className="me-modal" onPointerDown={e => e.stopPropagation()}>
        <div className="me-modal__title">
          <span>💾 Save Pattern</span>
          <button className="me-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="me-modal__body">
          <div className="me-modal__row">
            <label className="me-label">NAME</label>
            <input
              className="me-text-input"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={32}
              autoFocus
            />
          </div>
          {saves.length > 0 && (
            <div className="me-save-list">
              {saves.map(s => (
                <div key={s.name} className="me-save-item" onClick={() => setName(s.name)}>
                  <span>{s.name}</span>
                  <span className="me-label--dim">{s.savedAt.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="me-modal__footer">
          <button className="me-btn" onClick={onClose}>Cancel</button>
          <button className="me-btn me-btn--primary" onClick={() => { if (name.trim()) onSave(name.trim()); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

interface LoadDialogProps { onLoad: (p: Pattern) => void; onClose: () => void }

function LoadDialog({ onLoad, onClose }: LoadDialogProps) {
  const [saves, setSaves] = useState(getSaves);
  return (
    <div className="me-modal-backdrop" onPointerDown={onClose}>
      <div className="me-modal" onPointerDown={e => e.stopPropagation()}>
        <div className="me-modal__title">
          <span>📂 Load Pattern</span>
          <button className="me-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="me-modal__body">
          {saves.length === 0
            ? <p className="me-label me-label--dim">No saved patterns.</p>
            : (
              <div className="me-save-list">
                {saves.map(s => (
                  <div key={s.name} className="me-save-item me-save-item--load">
                    <button className="me-btn me-btn--sm" onClick={() => onLoad(migratePattern(s.pattern))}>
                      Load
                    </button>
                    <span>{s.name}</span>
                    <span className="me-label--dim">{s.savedAt.slice(0, 10)}</span>
                    <button
                      className="me-btn me-btn--sm me-btn--danger"
                      onClick={() => { deleteSave(s.name); setSaves(getSaves()); }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>
        <div className="me-modal__footer">
          <button className="me-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Transport bar ──────────────────────────────────────────────────────────────

interface TransportProps {
  pattern: Pattern;
  isPlaying: boolean;
  zoomIdx: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onBarsChange: (bars: number) => void;
  onStepsPerBeatChange: (spb: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
  onDownload: () => void;
}

function Transport({
  pattern, isPlaying, zoomIdx,
  onPlay, onStop, onBpmChange, onBarsChange, onStepsPerBeatChange,
  onZoomIn, onZoomOut, onNew, onSave, onLoad, onDownload,
}: TransportProps) {
  function nudge(delta: number) {
    onBpmChange(Math.max(40, Math.min(240, pattern.bpm + delta)));
  }

  return (
    <div className="me-transport">
      <div className="me-transport__row">
        <button className={`me-btn me-btn--play${isPlaying ? ' me-btn--stop' : ''}`} onPointerDown={isPlaying ? onStop : onPlay}>
          {isPlaying ? '■' : '▶'}
        </button>

        <div className="me-transport__group">
          <span className="me-label">BPM</span>
          <button className="me-btn me-btn--sm" onPointerDown={() => nudge(-5)}>−</button>
          <input
            className="me-num-input" type="number" min={40} max={240} value={pattern.bpm}
            onChange={e => onBpmChange(Number(e.target.value))}
          />
          <button className="me-btn me-btn--sm" onPointerDown={() => nudge(5)}>+</button>
        </div>

        <div className="me-transport__group">
          <span className="me-label">BARS</span>
          <select className="me-select" value={pattern.bars} onChange={e => onBarsChange(Number(e.target.value))}>
            {[1,2,4,8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="me-transport__group">
          <span className="me-label">GRID</span>
          <select className="me-select" value={pattern.stepsPerBeat} onChange={e => onStepsPerBeatChange(Number(e.target.value))}>
            <option value={2}>1/8</option>
            <option value={4}>1/16</option>
          </select>
        </div>

        <div className="me-transport__sep" />

        <div className="me-transport__group">
          <span className="me-label">ZOOM</span>
          <button className="me-btn me-btn--sm" onPointerDown={onZoomOut} disabled={zoomIdx <= 0}>−</button>
          <button className="me-btn me-btn--sm" onPointerDown={onZoomIn}  disabled={zoomIdx >= ZOOM_PRESETS.length - 1}>+</button>
        </div>

        <div className="me-transport__sep" />

        <button className="me-btn me-btn--sm" onPointerDown={onNew}      title="New pattern">NEW</button>
        <button className="me-btn me-btn--sm" onPointerDown={onSave}     title="Save to library">SAVE</button>
        <button className="me-btn me-btn--sm" onPointerDown={onLoad}     title="Load from library">LOAD</button>
        <button className="me-btn me-btn--sm" onPointerDown={onDownload} title="Download as JSON">⤓JSON</button>

        <span className="me-label me-label--dim">SPACE=play</span>
      </div>
    </div>
  );
}

// ── Melodic note grid ──────────────────────────────────────────────────────────

interface MelodicGridProps {
  track: Track;
  totalSteps: number;
  stepsPerBeat: number;
  beatsPerBar: number;
  stepW: number;
  rowH: number;
  paintModeRef: React.MutableRefObject<PaintState>;
  onAddNote: (pitch: number, step: number) => void;
  onRemoveNote: (noteId: string) => void;
  onStartResize: (noteId: string, startX: number, origDur: number, noteStart: number) => void;
  onPreviewPitch: (pitch: number) => void;
}

function MelodicGrid({
  track, totalSteps, stepsPerBeat, beatsPerBar, stepW, rowH,
  paintModeRef, onAddNote, onRemoveNote, onStartResize, onPreviewPitch,
}: MelodicGridProps) {
  const noteMap  = useMemo(() => buildNoteMap(track), [track]);
  const gridW    = totalSteps * stepW;
  const gridH    = PITCH_RANGE.length * rowH;

  const noteRects = useMemo(
    () => track.notes.filter(n => n.startStep < totalSteps),
    [track.notes, totalSteps],
  );

  function cellDown(pitch: number, step: number) {
    const existingId = noteMap.get(`${pitch},${step}`);
    if (existingId) {
      paintModeRef.current = { action: 'remove', trackId: track.id };
      onRemoveNote(existingId);
    } else {
      paintModeRef.current = { action: 'add', trackId: track.id };
      onAddNote(pitch, step);
      onPreviewPitch(pitch);
    }
  }

  return (
    <div
      className="me-note-grid"
      style={{ width: gridW, height: gridH }}
    >
      {/* Step column markers */}
      {Array.from({ length: totalSteps }, (_, s) => {
        const isBar  = s % (stepsPerBeat * beatsPerBar) === 0;
        const isBeat = !isBar && s % stepsPerBeat === 0;
        const isQ4   = !isBar && !isBeat && s % 4 === 0;
        return (
          <div
            key={`sc-${s}`}
            className={`me-step-col${isBar?' me-step-col--bar':isBeat?' me-step-col--beat':isQ4?' me-step-col--q4':''}`}
            style={{ left: s * stepW, width: stepW, height: gridH }}
          />
        );
      })}

      {/* Background cells */}
      {PITCH_RANGE.map((pitch, rowIdx) => {
        const isBlack = isBlackPitch(pitch);
        return Array.from({ length: totalSteps }, (_, step) => {
          if (noteMap.has(`${pitch},${step}`)) return null;
          return (
            <div
              key={`bg-${pitch}-${step}`}
              className={`me-cell ${isBlack ? 'me-cell--black' : 'me-cell--white'}`}
              style={{ left: step * stepW, top: rowIdx * rowH, width: stepW, height: rowH }}
              data-pitch={pitch}
              data-step={step}
              data-track-id={track.id}
              onPointerDown={e => { e.preventDefault(); cellDown(pitch, step); }}
            />
          );
        });
      })}

      {/* Note rectangles */}
      {noteRects.map(note => {
        const rowIdx = PITCH_TO_ROW.get(note.pitch);
        if (rowIdx === undefined) return null;
        const displayDur = Math.min(note.durationSteps, totalSteps - note.startStep);
        const noteW = displayDur * stepW;
        return (
          <div
            key={note.id}
            className="me-note-rect"
            style={{
              left: note.startStep * stepW, top: rowIdx * rowH,
              width: noteW, height: rowH, background: track.color,
            }}
            data-note-id={note.id}
            data-track-id={track.id}
            onPointerDown={e => {
              e.preventDefault(); e.stopPropagation();
              paintModeRef.current = { action: 'remove', trackId: track.id };
              onRemoveNote(note.id);
            }}
          >
            <div
              className="me-note-resize-handle"
              onPointerDown={e => {
                e.stopPropagation(); e.preventDefault();
                paintModeRef.current = null;
                onStartResize(note.id, e.clientX, note.durationSteps, note.startStep);
              }}
            />
          </div>
        );
      })}

      {/* Octave dividers at each C */}
      {PITCH_RANGE.map((pitch, rowIdx) =>
        pitch % 12 === 0
          ? <div key={`od-${pitch}`} className="me-row-divider" style={{ top: rowIdx * rowH, width: gridW }} />
          : null
      )}
    </div>
  );
}

// ── Drum grid ──────────────────────────────────────────────────────────────────

interface DrumGridProps {
  track: Track;
  totalSteps: number;
  stepsPerBeat: number;
  beatsPerBar: number;
  stepW: number;
  rowH: number;
  paintModeRef: React.MutableRefObject<PaintState>;
  onAddNote: (pitch: number, step: number) => void;
  onRemoveNote: (noteId: string) => void;
  onPreviewDrum: (pitch: number) => void;
}

function DrumGrid({
  track, totalSteps, stepsPerBeat, beatsPerBar, stepW, rowH,
  paintModeRef, onAddNote, onRemoveNote, onPreviewDrum,
}: DrumGridProps) {
  const drumNoteMap = useMemo(() => buildNoteMap(track), [track]);
  const gridW = totalSteps * stepW;
  const gridH = DRUM_TYPES.length * rowH;

  function cellDown(pitch: number, step: number, existingId: string | undefined) {
    if (existingId) {
      paintModeRef.current = { action: 'remove', trackId: track.id };
      onRemoveNote(existingId);
    } else {
      paintModeRef.current = { action: 'add', trackId: track.id };
      onAddNote(pitch, step);
      onPreviewDrum(pitch);
    }
  }

  return (
    <div className="me-drum-grid" style={{ width: gridW, height: gridH }}>
      {/* Step columns */}
      {Array.from({ length: totalSteps }, (_, s) => {
        const isBar  = s % (stepsPerBeat * beatsPerBar) === 0;
        const isBeat = !isBar && s % stepsPerBeat === 0;
        const isQ4   = !isBar && !isBeat && s % 4 === 0;
        return (
          <div
            key={`ds-${s}`}
            className={`me-step-col${isBar?' me-step-col--bar':isBeat?' me-step-col--beat':isQ4?' me-step-col--q4':''}`}
            style={{ left: s * stepW, width: stepW, height: gridH }}
          />
        );
      })}

      {/* Drum cells */}
      {DRUM_TYPES.map((dt: DrumType, rowIdx) => {
        const pitch  = DRUM_PITCHES[dt];
        const rowTop = rowIdx * rowH;
        return Array.from({ length: totalSteps }, (_, step) => {
          const existingId = drumNoteMap.get(`${pitch},${step}`);
          const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
          const isBeat = !isBar && step % stepsPerBeat === 0;
          return (
            <div
              key={`dcell-${dt}-${step}`}
              className={`me-drum-cell${existingId ? ' me-drum-cell--on' : ''}${isBar ? ' me-drum-cell--bar' : isBeat ? ' me-drum-cell--beat' : ''}`}
              style={{
                left: step * stepW, top: rowTop, width: stepW, height: rowH,
                ...((existingId ? { '--drum-color': track.color } : {}) as React.CSSProperties),
              }}
              data-drum-pitch={pitch}
              data-step={step}
              data-track-id={track.id}
              data-note-id={existingId ?? ''}
              onPointerDown={e => { e.preventDefault(); cellDown(pitch, step, existingId); }}
            />
          );
        });
      })}
    </div>
  );
}

// ── Track section (accordion row) ─────────────────────────────────────────────

interface TrackSectionProps {
  track: Track;
  totalSteps: number;
  stepsPerBeat: number;
  beatsPerBar: number;
  stepW: number;
  rowH: number;
  canDelete: boolean;
  paintModeRef: React.MutableRefObject<PaintState>;
  onToggleCollapse: () => void;
  onGear: () => void;
  onDelete: () => void;
  onMute: () => void;
  onAddNote: (pitch: number, step: number) => void;
  onRemoveNote: (noteId: string) => void;
  onStartResize: (noteId: string, startX: number, origDur: number, noteStart: number) => void;
  onPreviewPitch: (pitch: number) => void;
  onPreviewDrum: (pitch: number) => void;
}

function TrackSection({
  track, totalSteps, stepsPerBeat, beatsPerBar, stepW, rowH, canDelete,
  paintModeRef, onToggleCollapse, onGear, onDelete, onMute,
  onAddNote, onRemoveNote, onStartResize, onPreviewPitch, onPreviewDrum,
}: TrackSectionProps) {
  const gridW    = totalSteps * stepW;
  const pitchH   = PITCH_RANGE.length * rowH;
  const drumH    = DRUM_TYPES.length * rowH;
  const contentH = track.isDrum ? drumH : pitchH;

  return (
    <div className="me-track-section" style={{ '--tcolor': track.color } as React.CSSProperties}>
      {/* Header row: sticky-left controls + colored fill */}
      <div className="me-track-header-row" style={{ height: HDR_H }}>
        <div className="me-track-header-left" style={{ width: LEFT_W }}>
          <button className="me-track-collapse" onPointerDown={onToggleCollapse} title="Collapse">
            {track.collapsed ? '▶' : '▼'}
          </button>
          <span
            className="me-track-color-dot"
            style={{ background: track.color }}
          />
          <span className="me-track-name">{track.name}</span>
          <div className="me-track-header-btns">
            <button
              className={`me-mute-btn${track.muted ? ' me-mute-btn--muted' : ''}`}
              onPointerDown={onMute}
              title={track.muted ? 'Unmute' : 'Mute'}
            >M</button>
            <button className="me-icon-btn" onPointerDown={onGear} title="Track settings">⚙</button>
            {canDelete && (
              <button className="me-icon-btn me-icon-btn--del" onPointerDown={onDelete} title="Delete track">✕</button>
            )}
          </div>
        </div>
        <div
          className="me-track-header-fill"
          style={{ width: gridW, background: track.color + '18' }}
        />
      </div>

      {/* Content: left sidebar (keys/labels) + note grid */}
      {!track.collapsed && (
        <div className="me-track-content">
          {/* Left sidebar: color strip + keys/labels */}
          <div className="me-track-left" style={{ width: LEFT_W, height: contentH }}>
            <div className="me-track-color-strip" style={{ background: track.color + '28' }} />
            <div className="me-track-keys-col" style={{ width: KEYS_W }}>
              {track.isDrum
                ? DRUM_TYPES.map((dt: DrumType) => (
                    <div
                      key={dt}
                      className="me-drum-key"
                      style={{ height: rowH }}
                      onPointerDown={() => onPreviewDrum(DRUM_PITCHES[dt])}
                    >
                      {DRUM_LABELS[dt]}
                    </div>
                  ))
                : PITCH_RANGE.map(pitch => {
                    const isBlack = isBlackPitch(pitch);
                    const isC     = pitch % 12 === 0;
                    return (
                      <div
                        key={pitch}
                        className={`me-key ${isBlack ? 'me-key--black' : 'me-key--white'}`}
                        style={{ height: rowH }}
                        onPointerDown={() => { onPreviewPitch(pitch); }}
                        onPointerEnter={e => { if (e.buttons === 1) onPreviewPitch(pitch); }}
                      >
                        {isC && <span className="me-key__label">{pitchName(pitch)}</span>}
                      </div>
                    );
                  })
              }
            </div>
          </div>

          {/* Note / drum grid */}
          {track.isDrum
            ? <DrumGrid
                track={track}
                totalSteps={totalSteps}
                stepsPerBeat={stepsPerBeat}
                beatsPerBar={beatsPerBar}
                stepW={stepW}
                rowH={rowH}
                paintModeRef={paintModeRef}
                onAddNote={onAddNote}
                onRemoveNote={onRemoveNote}
                onPreviewDrum={onPreviewDrum}
              />
            : <MelodicGrid
                track={track}
                totalSteps={totalSteps}
                stepsPerBeat={stepsPerBeat}
                beatsPerBar={beatsPerBar}
                stepW={stepW}
                rowH={rowH}
                paintModeRef={paintModeRef}
                onAddNote={onAddNote}
                onRemoveNote={onRemoveNote}
                onStartResize={onStartResize}
                onPreviewPitch={onPreviewPitch}
              />
          }
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface MidiEditorProps { onQuit?: () => void }

export default function MidiEditor({ onQuit }: MidiEditorProps) {
  const [pattern,     setPattern]     = useState<Pattern>(loadPattern);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [zoomIdx,     setZoomIdx]     = useState(loadZoomIdx);
  const [modalTid,    setModalTid]    = useState<string | null>(null);
  const [showSave,    setShowSave]    = useState(false);
  const [showLoad,    setShowLoad]    = useState(false);

  const { stepW, rowH } = ZOOM_PRESETS[zoomIdx];

  const patternRef     = useRef(pattern);
  patternRef.current   = pattern;
  const stepWRef       = useRef(stepW);
  stepWRef.current     = stepW;

  const isPlayingRef   = useRef(false);
  const stepRef        = useRef(0);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playheadRef    = useRef<HTMLDivElement | null>(null);

  const paintModeRef   = useRef<PaintState>(null);
  const resizeModeRef  = useRef(false);
  const resizeStateRef = useRef<ResizeState | null>(null);

  const totalSteps = useMemo(
    () => pattern.bars * pattern.beatsPerBar * pattern.stepsPerBeat,
    [pattern.bars, pattern.beatsPerBar, pattern.stepsPerBeat],
  );
  const gridW = totalSteps * stepW;

  // ── Auto-save to localStorage ────────────────────────────────────────────────

  useEffect(() => {
    try { localStorage.setItem(STORAGE_AUTO, JSON.stringify(pattern)); } catch { /* ignore */ }
  }, [pattern]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_ZOOM, String(zoomIdx)); } catch { /* ignore */ }
  }, [zoomIdx]);

  // ── Playback ──────────────────────────────────────────────────────────────────

  function movePlayhead(step: number) {
    if (playheadRef.current) {
      playheadRef.current.style.display    = 'block';
      playheadRef.current.style.transform  = `translateX(${LEFT_W + step * stepWRef.current}px)`;
    }
  }

  function hidePlayhead() {
    if (playheadRef.current) playheadRef.current.style.display = 'none';
  }

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
    stepRef.current = 0;
    setIsPlaying(false);
    hidePlayhead();
  }, []);

  const tick = useCallback(() => {
    if (!isPlayingRef.current) return;
    const pat   = patternRef.current;
    const total = pat.bars * pat.beatsPerBar * pat.stepsPerBeat;
    const step  = stepRef.current;
    movePlayhead(step);
    const stepDur = 60 / pat.bpm / pat.stepsPerBeat;
    pat.tracks.forEach(track => {
      if (track.muted) return;
      track.notes.forEach((note: Note) => {
        if (note.startStep !== step || note.startStep >= total) return;
        if (track.isDrum) playDrum(note.pitch, note.velocity);
        else playNote(note.pitch, note.velocity, note.durationSteps * stepDur * 0.85, track.waveform, undefined, track.volume);
      });
    });
    stepRef.current = (step + 1) % total;
    timerRef.current = setTimeout(tick, (60_000 / pat.bpm) / pat.stepsPerBeat);
  }, []);

  const startPlayback = useCallback(() => {
    resumeAudio();
    isPlayingRef.current = true;
    stepRef.current = 0;
    setIsPlaying(true);
    timerRef.current = setTimeout(tick, (60_000 / patternRef.current.bpm) / patternRef.current.stepsPerBeat);
  }, [tick]);

  useEffect(() => () => { stopPlayback(); }, [stopPlayback]);

  // ── Global pointer events (resize + drag-paint for touch) ─────────────────────

  // Stable ref-based handlers so the effect only runs once
  const pointerMoveHandlerRef = useRef<(e: PointerEvent) => void>(() => {});
  const pointerUpHandlerRef   = useRef<(e: PointerEvent) => void>(() => {});

  pointerMoveHandlerRef.current = (e: PointerEvent) => {
    // Resize takes priority
    if (resizeModeRef.current && resizeStateRef.current) {
      const { noteId, trackId, startX, origDuration, noteStartStep } = resizeStateRef.current;
      const pat    = patternRef.current;
      const maxDur = pat.bars * pat.beatsPerBar * pat.stepsPerBeat - noteStartStep;
      const newDur = Math.max(1, Math.min(maxDur, origDuration + Math.round((e.clientX - startX) / stepWRef.current)));
      setPattern(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => t.id !== trackId ? t : {
          ...t, notes: t.notes.map(n => n.id !== noteId ? n : { ...n, durationSteps: newDur }),
        }),
      }));
      return;
    }

    // Touch drag-paint: use elementFromPoint to find target cell
    const pm = paintModeRef.current;
    if (!pm) return;

    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!el) return;

    if (pm.action === 'add') {
      // Melodic background cell
      const bgCell = el.closest('[data-pitch][data-step]') as HTMLElement | null;
      if (bgCell && bgCell.dataset.trackId === pm.trackId && !bgCell.classList.contains('me-note-rect')) {
        const pitch = parseInt(bgCell.dataset.pitch ?? '');
        const step  = parseInt(bgCell.dataset.step  ?? '');
        if (!isNaN(pitch) && !isNaN(step)) {
          setPattern(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => {
              if (t.id !== pm.trackId) return t;
              if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
              return { ...t, notes: [...t.notes, { id: makeNoteId(), pitch, startStep: step, durationSteps: 1, velocity: 100 }] };
            }),
          }));
        }
        return;
      }
      // Drum cell
      const drumCell = el.closest('[data-drum-pitch]') as HTMLElement | null;
      if (drumCell && drumCell.dataset.trackId === pm.trackId && !drumCell.classList.contains('me-drum-cell--on')) {
        const pitch = parseInt(drumCell.dataset.drumPitch ?? '');
        const step  = parseInt(drumCell.dataset.step      ?? '');
        if (!isNaN(pitch) && !isNaN(step)) {
          setPattern(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => {
              if (t.id !== pm.trackId) return t;
              if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
              return { ...t, notes: [...t.notes, { id: makeNoteId(), pitch, startStep: step, durationSteps: 1, velocity: 100 }] };
            }),
          }));
        }
      }
    } else {
      // Remove: note rect
      const noteRect = el.closest('[data-note-id]') as HTMLElement | null;
      if (noteRect && noteRect.dataset.trackId === pm.trackId) {
        const noteId = noteRect.dataset.noteId ?? '';
        if (noteId) {
          setPattern(prev => ({
            ...prev,
            tracks: prev.tracks.map(t =>
              t.id !== pm.trackId ? t : { ...t, notes: t.notes.filter(n => n.id !== noteId) }
            ),
          }));
        }
      }
    }
  };

  pointerUpHandlerRef.current = (_e: PointerEvent) => {
    paintModeRef.current   = null;
    resizeModeRef.current  = false;
    resizeStateRef.current = null;
  };

  useEffect(() => {
    const mv = (e: PointerEvent) => pointerMoveHandlerRef.current(e);
    const up = (e: PointerEvent) => pointerUpHandlerRef.current(e);
    document.addEventListener('pointermove', mv);
    document.addEventListener('pointerup',   up);
    return () => {
      document.removeEventListener('pointermove', mv);
      document.removeEventListener('pointerup',   up);
    };
  }, []);

  // ── Spacebar play/pause ────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (isPlayingRef.current) stopPlayback(); else startPlayback();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [startPlayback, stopPlayback]);

  // ── Note / track callbacks ─────────────────────────────────────────────────────

  const addNote = useCallback((trackId: string, pitch: number, step: number) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
        return { ...t, notes: [...t.notes, { id: makeNoteId(), pitch, startStep: step, durationSteps: 1, velocity: 100 }] };
      }),
    }));
  }, []);

  const removeNote = useCallback((trackId: string, noteId: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id !== trackId ? t : { ...t, notes: t.notes.filter(n => n.id !== noteId) }
      ),
    }));
  }, []);

  const startResize = useCallback((noteId: string, trackId: string, startX: number, origDuration: number, noteStartStep: number) => {
    resizeModeRef.current  = true;
    resizeStateRef.current = { noteId, trackId, startX, origDuration, noteStartStep };
  }, []);

  const previewPitch = useCallback((track: Track, pitch: number) => {
    resumeAudio();
    playNote(pitch, 100, 0.35, track.waveform, undefined, track.volume);
  }, []);

  const previewDrum = useCallback((pitch: number) => {
    resumeAudio();
    playDrum(pitch, 100);
  }, []);

  const muteTrack = useCallback((trackId: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t),
    }));
  }, []);

  const toggleCollapse = useCallback((trackId: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, collapsed: !t.collapsed } : t),
    }));
  }, []);

  const deleteTrack = useCallback((trackId: string) => {
    setPattern(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.id !== trackId) }));
  }, []);

  const updateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t),
    }));
  }, []);

  const addMelodicTrack = useCallback(() => {
    setPattern(prev => {
      if (prev.tracks.filter(t => !t.isDrum).length >= 10) return prev;
      const idx = prev.tracks.length;
      const newTrack: Track = {
        id: `t${makeNoteId()}`, name: `Track ${prev.tracks.filter(t=>!t.isDrum).length + 1}`,
        color: TRACK_COLORS[idx % TRACK_COLORS.length],
        waveform: 'sine', notes: [], muted: false, isDrum: false,
        volume: 1, attack: 0.01, release: 0.3, collapsed: false,
      };
      return { ...prev, tracks: [...prev.tracks, newTrack] };
    });
  }, []);

  const addDrumTrack = useCallback(() => {
    setPattern(prev => {
      const drumCount  = prev.tracks.filter(t => t.isDrum).length;
      const lastDrumIdx = prev.tracks.reduce((acc, t, i) => t.isDrum ? i : acc, -1);
      const newTrack: Track = {
        id: `d${makeNoteId()}`, name: `Drums ${drumCount + 1}`,
        color: TRACK_COLORS[(drumCount + 3) % TRACK_COLORS.length],
        waveform: 'sine', notes: [], muted: false, isDrum: true,
        volume: 1, attack: 0.01, release: 0.3, collapsed: false,
      };
      const tracks = [...prev.tracks];
      tracks.splice(lastDrumIdx + 1, 0, newTrack);
      return { ...prev, tracks };
    });
  }, []);

  const newPattern = useCallback(() => {
    stopPlayback();
    setPattern(createInitialPattern());
  }, [stopPlayback]);

  // ── Window menus ───────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: 'File',
      items: [
        { label: 'New Pattern',       onClick: newPattern },
        { label: 'Save to Library…',  onClick: () => setShowSave(true) },
        { label: 'Load from Library…',onClick: () => setShowLoad(true) },
        { label: 'Download JSON',     onClick: () => downloadJson(patternRef.current) },
        ...(onQuit ? [{ separator: true as const }, { label: 'Close', onClick: onQuit }] : []),
      ],
    },
    {
      label: 'Playback',
      items: [
        { label: isPlaying ? 'Stop ■' : 'Play ▶', onClick: isPlaying ? stopPlayback : startPlayback },
        { separator: true },
        { label: 'BPM 80',  onClick: () => setPattern(p => ({ ...p, bpm: 80  })) },
        { label: 'BPM 120', onClick: () => setPattern(p => ({ ...p, bpm: 120 })) },
        { label: 'BPM 160', onClick: () => setPattern(p => ({ ...p, bpm: 160 })) },
      ],
    },
  ], [isPlaying, startPlayback, stopPlayback, newPattern, onQuit]);

  useWindowMenus(menus);

  // ── Render ─────────────────────────────────────────────────────────────────────

  const rulerSteps: { s: number; isBar: boolean; label: string }[] = useMemo(() =>
    Array.from({ length: totalSteps }, (_, s) => {
      const isBar  = s % (pattern.stepsPerBeat * pattern.beatsPerBar) === 0;
      const isBeat = !isBar && s % pattern.stepsPerBeat === 0;
      if (!isBar && !isBeat) return null;
      return { s, isBar, label: isBar ? String(s / (pattern.stepsPerBeat * pattern.beatsPerBar) + 1) : '' };
    }).filter((x): x is { s: number; isBar: boolean; label: string } => x !== null),
    [totalSteps, pattern.stepsPerBeat, pattern.beatsPerBar],
  );

  const modalTrack = modalTid ? pattern.tracks.find(t => t.id === modalTid) : null;

  return (
    <div className="me-root">
      <Transport
        pattern={pattern}
        isPlaying={isPlaying}
        zoomIdx={zoomIdx}
        onPlay={startPlayback}
        onStop={stopPlayback}
        onBpmChange={bpm => setPattern(p => ({ ...p, bpm: Math.max(40, Math.min(240, bpm)) }))}
        onBarsChange={bars => { stopPlayback(); setPattern(p => ({ ...p, bars })); }}
        onStepsPerBeatChange={spb => { stopPlayback(); setPattern(p => ({ ...p, stepsPerBeat: spb })); }}
        onZoomIn={() => setZoomIdx(i => Math.min(i + 1, ZOOM_PRESETS.length - 1))}
        onZoomOut={() => setZoomIdx(i => Math.max(i - 1, 0))}
        onNew={newPattern}
        onSave={() => setShowSave(true)}
        onLoad={() => setShowLoad(true)}
        onDownload={() => downloadJson(patternRef.current)}
      />

      {/* Main grid: single overflow:auto container */}
      <div className="me-outer">
        <div className="me-inner" style={{ minWidth: LEFT_W + gridW }}>

          {/* Time ruler — sticky top */}
          <div className="me-ruler" style={{ height: RULER_H }}>
            <div className="me-ruler-corner" style={{ width: LEFT_W }} />
            <div className="me-ruler-steps" style={{ width: gridW, height: RULER_H }}>
              {rulerSteps.map(({ s, isBar, label }) => (
                <div
                  key={s}
                  className={`me-ruler-mark${isBar ? ' me-ruler-mark--bar' : ' me-ruler-mark--beat'}`}
                  style={{ left: s * stepW }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Track list */}
          {pattern.tracks.map(track => (
            <TrackSection
              key={track.id}
              track={track}
              totalSteps={totalSteps}
              stepsPerBeat={pattern.stepsPerBeat}
              beatsPerBar={pattern.beatsPerBar}
              stepW={stepW}
              rowH={rowH}
              canDelete={pattern.tracks.length > 1}
              paintModeRef={paintModeRef}
              onToggleCollapse={() => toggleCollapse(track.id)}
              onGear={() => setModalTid(track.id)}
              onDelete={() => deleteTrack(track.id)}
              onMute={() => muteTrack(track.id)}
              onAddNote={(pitch, step) => addNote(track.id, pitch, step)}
              onRemoveNote={noteId => removeNote(track.id, noteId)}
              onStartResize={(noteId, startX, origDur, noteStart) =>
                startResize(noteId, track.id, startX, origDur, noteStart)
              }
              onPreviewPitch={pitch => previewPitch(track, pitch)}
              onPreviewDrum={previewDrum}
            />
          ))}

          {/* Add track row */}
          <div className="me-add-track-row" style={{ height: HDR_H }}>
            <div className="me-add-track-left" style={{ width: LEFT_W }}>
              <button className="me-btn me-btn--sm" onPointerDown={addDrumTrack}>+ Drums</button>
              <button className="me-btn me-btn--sm" onPointerDown={addMelodicTrack}>+ Melody</button>
            </div>
            <div className="me-add-track-fill" style={{ width: gridW }} />
          </div>

          {/* Playhead — positioned in content space */}
          <div
            className="me-playhead"
            ref={playheadRef}
            style={{ top: RULER_H, display: 'none' }}
          />
        </div>
      </div>

      {/* Overlays */}
      {modalTrack && (
        <InstrumentModal
          track={modalTrack}
          onSave={updates => { updateTrack(modalTrack.id, updates); setModalTid(null); }}
          onClose={() => setModalTid(null)}
        />
      )}
      {showSave && (
        <SaveDialog
          onSave={name => { persistSave(name, patternRef.current); setShowSave(false); }}
          onClose={() => setShowSave(false)}
        />
      )}
      {showLoad && (
        <LoadDialog
          onLoad={p => { stopPlayback(); setPattern(p); setShowLoad(false); }}
          onClose={() => setShowLoad(false)}
        />
      )}
    </div>
  );
}
