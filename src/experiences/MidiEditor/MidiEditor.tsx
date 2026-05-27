import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useWindowMenus } from '../../components/Window/useWindowMenus';
import type { MenuBarMenu } from '../../components/MenuBar/MenuBar';
import {
  type Pattern, type Track, type Note, type DrumType, type OscWaveform, type EditTool,
  DRUM_LABELS, DRUM_PITCHES, PIANO_MIN, PIANO_MAX,
  isBlackPitch, pitchName, makeNoteId, createInitialPattern, TRACK_COLORS,
  drumPitchLabel, DEFAULT_DRUM_ROWS, GM_PROGRAMS,
} from './types';
import { resumeAudio, playNote, playDrum, loadSoundFont, isSoundFontReady, startSustainedNote } from './audio';
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
type MoveNote = { trackId: string; origPitch: number; origStep: number };
type MoveState = { startClientX: number; startClientY: number; notes: Map<string, MoveNote> };
type ClipboardNote = { trackId: string; note: Note };

interface SaveEntry { name: string; pattern: Pattern; savedAt: string }

// ── Storage helpers ────────────────────────────────────────────────────────────

const STORAGE_AUTO  = 'midi-editor-pattern';
const STORAGE_SAVES = 'midi-editor-saves';
const STORAGE_ZOOM  = 'midi-editor-zoom';

function migrateTrack(t: Track): Track {
  const defaults: Partial<Track> = { volume: 1, attack: 0.01, release: 0.3, collapsed: false, octaveOffset: 0 };
  if (t.isDrum && !t.drumRows) defaults.drumRows = [...DEFAULT_DRUM_ROWS];
  return { ...defaults, ...t } as Track;
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
  canDelete: boolean;
  onSave: (updates: Partial<Track>) => void;
  onClose: () => void;
  onDelete: () => void;
}

const GM_GROUPS = [
  { label: 'Piano',        start: 0   },
  { label: 'Chr Perc',     start: 8   },
  { label: 'Organ',        start: 16  },
  { label: 'Guitar',       start: 24  },
  { label: 'Bass',         start: 32  },
  { label: 'Strings',      start: 40  },
  { label: 'Ensemble',     start: 48  },
  { label: 'Brass',        start: 56  },
  { label: 'Reed',         start: 64  },
  { label: 'Pipe',         start: 72  },
  { label: 'Synth Lead',   start: 80  },
  { label: 'Synth Pad',    start: 88  },
  { label: 'Synth FX',     start: 96  },
  { label: 'Ethnic',       start: 104 },
  { label: 'Percussive',   start: 112 },
  { label: 'Sound FX',     start: 120 },
];

function InstrumentModal({ track, canDelete, onSave, onClose, onDelete }: InstrumentModalProps) {
  const [name,         setName]         = useState(track.name);
  const [color,        setColor]        = useState(track.color);
  const [waveform,     setWaveform]     = useState(track.waveform);
  const [volume,       setVolume]       = useState(Math.round(track.volume * 100));
  const [sfMode,       setSfMode]       = useState(track.gmProgram !== undefined);
  const [gmProg,       setGmProg]       = useState(track.gmProgram ?? 0);
  const [octaveOffset, setOctaveOffset] = useState(track.octaveOffset ?? 0);

  function save() {
    onSave({ name, color, waveform, volume: volume / 100, gmProgram: sfMode ? gmProg : undefined, octaveOffset });
  }

  function previewSound() {
    resumeAudio();
    if (track.isDrum) {
      playDrum(track.drumRows?.[0] ?? 36, 100);
    } else {
      playNote(60 + octaveOffset, 100, 1.5, waveform, undefined, volume / 100, track.attack, track.release, sfMode ? gmProg : undefined);
    }
  }

  const gmRows: Array<{ type: 'group'; label: string } | { type: 'inst'; prog: number; label: string }> = [];
  let groupIdx = 0;
  for (let prog = 0; prog < GM_PROGRAMS.length; prog++) {
    const nextGroup = GM_GROUPS[groupIdx + 1];
    if (!nextGroup || prog < nextGroup.start) {
      // still in current group
    } else {
      groupIdx++;
    }
    if (prog === GM_GROUPS[groupIdx].start) {
      gmRows.push({ type: 'group', label: GM_GROUPS[groupIdx].label });
    }
    gmRows.push({ type: 'inst', prog, label: GM_PROGRAMS[prog] });
  }

  const OCTAVE_VALS = [-3, -2, -1, 0, 1, 2, 3];

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
            <>
              <div className="me-modal__row">
                <label className="me-label">SOURCE</label>
                <div className="me-source-toggle">
                  <button
                    className={`me-source-btn${!sfMode ? ' me-source-btn--active' : ''}`}
                    onClick={() => setSfMode(false)}
                  >OSC</button>
                  <button
                    className={`me-source-btn${sfMode ? ' me-source-btn--active' : ''}`}
                    onClick={() => setSfMode(true)}
                  >MIDI{!isSoundFontReady() ? '…' : ''}</button>
                </div>
              </div>

              {!sfMode && (
                <div className="me-modal__row">
                  <label className="me-label">WAVE</label>
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

              {sfMode && (
                <div className="me-modal__row me-modal__row--col">
                  <label className="me-label">INSTRUMENT — {GM_PROGRAMS[gmProg]}</label>
                  <div className="me-inst-picker">
                    {gmRows.map((row, i) =>
                      row.type === 'group'
                        ? <div key={i} className="me-inst-group">{row.label}</div>
                        : <button
                            key={row.prog}
                            className={`me-inst-item${row.prog === gmProg ? ' me-inst-item--active' : ''}`}
                            onClick={() => setGmProg(row.prog)}
                          >{row.label}</button>
                    )}
                  </div>
                </div>
              )}

              <div className="me-modal__row">
                <label className="me-label">OCTAVE</label>
                <div className="me-octave-btns">
                  {OCTAVE_VALS.map(v => (
                    <button
                      key={v}
                      className={`me-btn me-btn--sm${octaveOffset === v ? ' me-btn--primary' : ''}`}
                      onClick={() => setOctaveOffset(v)}
                    >
                      {v > 0 ? `+${v}` : `${v}`}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="me-modal__row">
            <label className="me-label">VOL {volume}%</label>
            <input
              type="range" min={0} max={100} value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="me-slider"
            />
          </div>

          <div className="me-modal__row">
            <label className="me-label">PREVIEW</label>
            <button className="me-btn me-btn--sm" onClick={previewSound}>Play</button>
          </div>
        </div>

        <div className="me-modal__footer">
          {canDelete && (
            <button className="me-btn me-btn--sm me-btn--danger" onClick={() => { onDelete(); }}>
              Delete Track
            </button>
          )}
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
  tool: EditTool;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onBarsChange: (bars: number) => void;
  onStepsPerBeatChange: (spb: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onNew: () => void;
  onToolChange: (t: EditTool) => void;
}

function Transport({
  pattern, isPlaying, zoomIdx, tool,
  onPlay, onStop, onBpmChange, onBarsChange, onStepsPerBeatChange,
  onZoomIn, onZoomOut, onNew, onToolChange,
}: TransportProps) {
  function nudge(delta: number) {
    onBpmChange(Math.max(40, Math.min(240, pattern.bpm + delta)));
  }

  const TOOLS: { key: EditTool; label: string; title: string }[] = [
    { key: 'select', label: 'SEL',   title: 'Select & move notes (S)' },
    { key: 'draw',   label: 'DRAW',  title: 'Draw one note, drag to set length (D)' },
    { key: 'paint',  label: 'PAINT', title: 'Paint notes by dragging (P)' },
  ];

  return (
    <div className="me-transport">
      <div className="me-transport__row">
        <button className={`me-btn me-btn--play${isPlaying ? ' me-btn--stop' : ''}`} onPointerDown={isPlaying ? onStop : onPlay}>
          {isPlaying ? '■' : '▶'}
        </button>

        <div className="me-transport__sep" />

        <div className="me-tool-group">
          {TOOLS.map(t => (
            <button
              key={t.key}
              className={`me-btn me-btn--sm${tool === t.key ? ' me-btn--primary' : ''}`}
              onPointerDown={() => onToolChange(t.key)}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="me-transport__sep" />

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

        <button className="me-btn me-btn--sm" onPointerDown={onNew} title="New pattern">NEW</button>

        <span className="me-label me-label--dim">SPC=play</span>
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
  tool: EditTool;
  selectedIds: ReadonlySet<string>;
  paintModeRef: React.MutableRefObject<PaintState>;
  lastNoteDurationRef: React.MutableRefObject<number>;
  onAddNote: (pitch: number, step: number, duration?: number, noteId?: string) => void;
  onRemoveNote: (noteId: string) => void;
  onStartResize: (noteId: string, startX: number, origDur: number, noteStart: number) => void;
  onPreviewPitch: (pitch: number) => void;
  onSelectNote: (noteId: string, addToSelection: boolean) => void;
  onDeselectAll: () => void;
  onStartMove: (noteId: string, clientX: number, clientY: number) => void;
}

function MelodicGrid({
  track, totalSteps, stepsPerBeat, beatsPerBar, stepW, rowH, tool,
  selectedIds, paintModeRef, lastNoteDurationRef,
  onAddNote, onRemoveNote, onStartResize, onPreviewPitch,
  onSelectNote, onDeselectAll, onStartMove,
}: MelodicGridProps) {
  const noteMap  = useMemo(() => buildNoteMap(track), [track]);
  const gridW    = totalSteps * stepW;
  const gridH    = PITCH_RANGE.length * rowH;

  const noteRects = useMemo(
    () => track.notes.filter(n => n.startStep < totalSteps),
    [track.notes, totalSteps],
  );

  function cellDown(pitch: number, step: number, e: React.PointerEvent) {
    if (tool === 'select') {
      onDeselectAll();
      return;
    }
    const existingId = noteMap.get(`${pitch},${step}`);
    if (existingId) {
      paintModeRef.current = { action: 'remove', trackId: track.id };
      onRemoveNote(existingId);
    } else if (tool === 'draw') {
      // DRAW: place note at remembered duration, immediately start resize so drag extends it
      const dur = lastNoteDurationRef.current;
      const newId = makeNoteId();
      onAddNote(pitch, step, dur, newId);
      onPreviewPitch(pitch);
      // startResize expects the note's right-edge — we pass e.clientX as anchor (note already at lastDur)
      onStartResize(newId, e.clientX, dur, step);
    } else {
      // PAINT
      paintModeRef.current = { action: 'add', trackId: track.id };
      onAddNote(pitch, step, lastNoteDurationRef.current);
      onPreviewPitch(pitch);
    }
  }

  const editActive = tool !== 'select';

  return (
    <div
      className={`me-note-grid${editActive ? ' me-note-grid--edit' : ' me-note-grid--select'}`}
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
          const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
          const isBeat = !isBar && step % stepsPerBeat === 0;
          const beatCls = isBar ? ' me-cell--bar' : isBeat ? ' me-cell--beat' : '';
          return (
            <div
              key={`bg-${pitch}-${step}`}
              className={`me-cell ${isBlack ? 'me-cell--black' : 'me-cell--white'}${beatCls}`}
              style={{ left: step * stepW, top: rowIdx * rowH, width: stepW, height: rowH }}
              data-pitch={pitch}
              data-step={step}
              data-track-id={track.id}
              onPointerDown={(e: React.PointerEvent) => { e.preventDefault(); cellDown(pitch, step, e); }}
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
        const isSelected = selectedIds.has(note.id);
        return (
          <div
            key={note.id}
            className={`me-note-rect${isSelected ? ' me-note-rect--selected' : ''}`}
            style={{
              left: note.startStep * stepW, top: rowIdx * rowH,
              width: noteW, height: rowH, background: track.color,
            }}
            data-note-id={note.id}
            data-track-id={track.id}
            onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); onRemoveNote(note.id); }}
            onPointerDown={(e: React.PointerEvent) => {
              e.preventDefault(); e.stopPropagation();
              if (tool === 'select') {
                onSelectNote(note.id, e.ctrlKey || e.metaKey);
                onStartMove(note.id, e.clientX, e.clientY);
              } else {
                paintModeRef.current = { action: 'remove', trackId: track.id };
                onRemoveNote(note.id);
              }
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
  tool: EditTool;
  paintModeRef: React.MutableRefObject<PaintState>;
  onAddNote: (pitch: number, step: number) => void;
  onRemoveNote: (noteId: string) => void;
  onPreviewDrum: (pitch: number) => void;
}

function DrumGrid({
  track, totalSteps, stepsPerBeat, beatsPerBar, stepW, rowH, tool,
  paintModeRef, onAddNote, onRemoveNote, onPreviewDrum,
}: DrumGridProps) {
  const drumNoteMap   = useMemo(() => buildNoteMap(track), [track]);
  const activeDrumRows = track.drumRows?.length ? track.drumRows : DEFAULT_DRUM_ROWS;
  const gridW = totalSteps * stepW;
  const gridH = activeDrumRows.length * rowH;

  const editActive = tool !== 'select';

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
    <div className={`me-drum-grid${editActive ? ' me-drum-grid--edit' : ''}`} style={{ width: gridW, height: gridH }}>
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
      {activeDrumRows.map((pitch, rowIdx) => {
        const rowTop = rowIdx * rowH;
        return Array.from({ length: totalSteps }, (_, step) => {
          const existingId = drumNoteMap.get(`${pitch},${step}`);
          const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
          const isBeat = !isBar && step % stepsPerBeat === 0;
          return (
            <div
              key={`dcell-${pitch}-${step}`}
              className={`me-drum-cell${existingId ? ' me-drum-cell--on' : ''}${isBar ? ' me-drum-cell--bar' : isBeat ? ' me-drum-cell--beat' : ''}`}
              style={{
                left: step * stepW, top: rowTop, width: stepW, height: rowH,
                ...((existingId ? { '--drum-color': track.color } : {}) as React.CSSProperties),
              }}
              data-drum-pitch={pitch}
              data-step={step}
              data-track-id={track.id}
              data-note-id={existingId ?? ''}
              onContextMenu={(e: React.MouseEvent) => { if (existingId) { e.preventDefault(); onRemoveNote(existingId); } }}
              {...(editActive ? { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); cellDown(pitch, step, existingId); } } : {})}
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
  tool: EditTool;
  selectedIds: ReadonlySet<string>;
  paintModeRef: React.MutableRefObject<PaintState>;
  lastNoteDurationRef: React.MutableRefObject<number>;
  onToggleCollapse: () => void;
  onGear: () => void;
  onMute: () => void;
  onAddNote: (pitch: number, step: number, duration?: number, noteId?: string) => void;
  onAddDrumNote: (pitch: number, step: number) => void;
  onRemoveNote: (noteId: string) => void;
  onStartResize: (noteId: string, startX: number, origDur: number, noteStart: number) => void;
  onStartPreviewPitch: (pitch: number) => void;
  onStopPreviewPitch: () => void;
  onPreviewDrum: (pitch: number) => void;
  onAddDrumPiece: (pitch: number) => void;
  onRemoveDrumPiece: (pitch: number) => void;
  onSelectNote: (noteId: string, addToSelection: boolean) => void;
  onDeselectAll: () => void;
  onStartMove: (noteId: string, clientX: number, clientY: number) => void;
}

function TrackSection({
  track, totalSteps, stepsPerBeat, beatsPerBar, stepW, rowH, tool,
  selectedIds, paintModeRef, lastNoteDurationRef,
  onToggleCollapse, onGear, onMute,
  onAddNote, onAddDrumNote, onRemoveNote, onStartResize,
  onStartPreviewPitch, onStopPreviewPitch, onPreviewDrum,
  onAddDrumPiece, onRemoveDrumPiece,
  onSelectNote, onDeselectAll, onStartMove,
}: TrackSectionProps) {
  const [showAddPiece, setShowAddPiece] = useState(false);

  const activeDrumRows = track.drumRows?.length ? track.drumRows : DEFAULT_DRUM_ROWS;
  const gridW    = totalSteps * stepW;
  const pitchH   = PITCH_RANGE.length * rowH;
  const drumH    = activeDrumRows.length * rowH;
  const contentH = track.isDrum ? drumH : pitchH;

  const availablePieces = (Object.keys(DRUM_PITCHES) as DrumType[])
    .filter(dt => !activeDrumRows.includes(DRUM_PITCHES[dt]));

  return (
    <div className="me-track-section" style={{ '--tcolor': track.color } as React.CSSProperties}>
      {/* Header row */}
      <div className="me-track-header-row" style={{ height: HDR_H }}>
        <div className="me-track-header-left" style={{ width: LEFT_W }}>
          <button className="me-track-collapse" onPointerDown={onToggleCollapse} title="Collapse">
            {track.collapsed ? '▶' : '▼'}
          </button>
          <span className="me-track-color-dot" style={{ background: track.color }} />
          <span className="me-track-name">{track.name}</span>
          <div className="me-track-header-btns">
            <button
              className={`me-mute-btn${track.muted ? ' me-mute-btn--muted' : ''}`}
              onPointerDown={onMute}
              title={track.muted ? 'Unmute' : 'Mute'}
            >M</button>
            <button className="me-btn me-btn--sm me-btn--edit" onPointerDown={onGear} title="Track settings">EDIT</button>
          </div>
        </div>
        <div className="me-track-header-fill" style={{ width: gridW, background: track.color + '18' }} />
      </div>

      {/* Content */}
      {!track.collapsed && (
        <>
          <div className="me-track-content">
            <div className="me-track-left" style={{ width: LEFT_W, height: contentH }}>
              <div className="me-track-color-strip" style={{ background: track.color + '28' }} />
              <div className="me-track-keys-col" style={{ width: KEYS_W }}>
                {track.isDrum
                  ? activeDrumRows.map(pitch => (
                      <div
                        key={pitch}
                        className="me-drum-key"
                        style={{ height: rowH }}
                        onPointerDown={() => onPreviewDrum(pitch)}
                      >
                        <span>{drumPitchLabel(pitch)}</span>
                        <button
                          className="me-drum-row-remove"
                          onPointerDown={e => { e.stopPropagation(); onRemoveDrumPiece(pitch); }}
                          title="Remove row"
                        >×</button>
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
                          onPointerDown={() => { onStartPreviewPitch(pitch); }}
                          onPointerEnter={e => { if (e.buttons === 1) onStartPreviewPitch(pitch); }}
                          onPointerUp={onStopPreviewPitch}
                        >
                          {isC && <span className="me-key__label">{pitchName(pitch)}</span>}
                        </div>
                      );
                    })
                }
              </div>
            </div>

            {track.isDrum
              ? <DrumGrid
                  track={track}
                  totalSteps={totalSteps}
                  stepsPerBeat={stepsPerBeat}
                  beatsPerBar={beatsPerBar}
                  stepW={stepW}
                  rowH={rowH}
                  tool={tool}
                  paintModeRef={paintModeRef}
                  onAddNote={onAddDrumNote}
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
                  tool={tool}
                  selectedIds={selectedIds}
                  paintModeRef={paintModeRef}
                  lastNoteDurationRef={lastNoteDurationRef}
                  onAddNote={onAddNote}
                  onRemoveNote={onRemoveNote}
                  onStartResize={onStartResize}
                  onPreviewPitch={pitch => onStartPreviewPitch(pitch)}
                  onSelectNote={onSelectNote}
                  onDeselectAll={onDeselectAll}
                  onStartMove={onStartMove}
                />
            }
          </div>

          {/* + Piece row for drum tracks */}
          {track.isDrum && (
            <div className="me-drum-add-piece-row" style={{ height: HDR_H }}>
              <div className="me-drum-add-piece-left" style={{ width: LEFT_W }}>
                <div style={{ position: 'relative' }}>
                  <button
                    className="me-btn me-btn--sm"
                    onPointerDown={() => setShowAddPiece(v => !v)}
                    disabled={availablePieces.length === 0}
                  >
                    + Piece
                  </button>
                  {showAddPiece && (
                    <div className="me-drum-piece-menu">
                      {availablePieces.map(dt => (
                        <button
                          key={dt}
                          className="me-drum-piece-option"
                          onPointerDown={() => { onAddDrumPiece(DRUM_PITCHES[dt]); setShowAddPiece(false); }}
                        >
                          {DRUM_LABELS[dt]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="me-add-track-fill" style={{ width: gridW }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface MidiEditorProps { onQuit?: () => void }

export default function MidiEditor({ onQuit }: MidiEditorProps) {
  const [pattern,   setPattern]   = useState<Pattern>(loadPattern);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomIdx,   setZoomIdx]   = useState(loadZoomIdx);
  const [tool,      setTool]      = useState<EditTool>('paint');
  const [modalTid,  setModalTid]  = useState<string | null>(null);
  const [showSave,  setShowSave]  = useState(false);
  const [showLoad,  setShowLoad]  = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());

  const { stepW, rowH } = ZOOM_PRESETS[zoomIdx];

  const patternRef   = useRef(pattern);
  patternRef.current = pattern;
  const stepWRef     = useRef(stepW);
  stepWRef.current   = stepW;
  const rowHRef      = useRef(rowH);
  rowHRef.current    = rowH;
  const toolRef      = useRef<EditTool>('paint');
  toolRef.current    = tool;
  const selectedIdsRef = useRef<Set<string>>(new Set<string>());
  selectedIdsRef.current = selectedIds;

  const isPlayingRef   = useRef(false);
  const stepRef        = useRef(0);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playheadRef    = useRef<HTMLDivElement | null>(null);

  const paintModeRef   = useRef<PaintState>(null);
  const resizeModeRef  = useRef(false);
  const resizeStateRef = useRef<ResizeState | null>(null);

  // Last note duration — remembered across DRAW and PAINT operations
  const lastNoteDurationRef = useRef<number>(1);

  // Sustained piano-key preview
  const sustainedNoteStopRef = useRef<(() => void) | null>(null);

  // Move-selected-notes state
  const isMoveActiveRef = useRef(false);
  const moveStateRef    = useRef<MoveState | null>(null);

  // Copy/paste clipboard
  const clipboardRef = useRef<ClipboardNote[]>([]);

  const totalSteps = useMemo(
    () => pattern.bars * pattern.beatsPerBar * pattern.stepsPerBeat,
    [pattern.bars, pattern.beatsPerBar, pattern.stepsPerBeat],
  );
  const gridW = totalSteps * stepW;

  // ── Auto-save ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try { localStorage.setItem(STORAGE_AUTO, JSON.stringify(pattern)); } catch { /* ignore */ }
  }, [pattern]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_ZOOM, String(zoomIdx)); } catch { /* ignore */ }
  }, [zoomIdx]);

  // ── Playback ───────────────────────────────────────────────────────────────

  function movePlayhead(step: number) {
    if (playheadRef.current) {
      playheadRef.current.style.display   = 'block';
      playheadRef.current.style.transform = `translateX(${LEFT_W + step * stepWRef.current}px)`;
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
      const shift = track.octaveOffset ?? 0;
      track.notes.forEach((note: Note) => {
        if (note.startStep !== step || note.startStep >= total) return;
        if (track.isDrum) playDrum(note.pitch, note.velocity);
        else playNote(note.pitch + shift, note.velocity, note.durationSteps * stepDur, track.waveform, undefined, track.volume, track.attack, track.release, track.gmProgram);
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

  useEffect(() => { loadSoundFont('/TimGM6mb.sf2').catch(() => { /* non-fatal */ }); }, []);

  // ── Global pointer events ──────────────────────────────────────────────────

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

    // Move selected notes
    if (isMoveActiveRef.current && moveStateRef.current) {
      const ms = moveStateRef.current;
      const stepDelta  = Math.round((e.clientX - ms.startClientX) / stepWRef.current);
      const pitchDelta = -Math.round((e.clientY - ms.startClientY) / rowHRef.current);
      const total = patternRef.current.bars * patternRef.current.beatsPerBar * patternRef.current.stepsPerBeat;
      setPattern(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => ({
          ...t,
          notes: t.notes.map(n => {
            const orig = ms.notes.get(n.id);
            if (!orig || orig.trackId !== t.id) return n;
            const newPitch = Math.max(PIANO_MIN, Math.min(PIANO_MAX, orig.origPitch + pitchDelta));
            const newStep  = Math.max(0, Math.min(total - n.durationSteps, orig.origStep + stepDelta));
            return { ...n, pitch: newPitch, startStep: newStep };
          }),
        })),
      }));
      return;
    }

    // Touch drag-paint
    const pm = paintModeRef.current;
    if (!pm) return;

    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!el) return;

    if (pm.action === 'add') {
      const bgCell = el.closest('[data-pitch][data-step]') as HTMLElement | null;
      if (bgCell && bgCell.dataset.trackId === pm.trackId && !bgCell.classList.contains('me-note-rect')) {
        const pitch = parseInt(bgCell.dataset.pitch ?? '');
        const step  = parseInt(bgCell.dataset.step  ?? '');
        if (!isNaN(pitch) && !isNaN(step)) {
          const dur = lastNoteDurationRef.current;
          setPattern(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => {
              if (t.id !== pm.trackId) return t;
              if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
              return { ...t, notes: [...t.notes, { id: makeNoteId(), pitch, startStep: step, durationSteps: dur, velocity: 100 }] };
            }),
          }));
        }
        return;
      }
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
    // Save final resize duration as last note duration
    if (resizeModeRef.current && resizeStateRef.current) {
      const { noteId, trackId } = resizeStateRef.current;
      const track = patternRef.current.tracks.find(t => t.id === trackId);
      const note  = track?.notes.find(n => n.id === noteId);
      if (note) lastNoteDurationRef.current = note.durationSteps;
    }
    paintModeRef.current   = null;
    resizeModeRef.current  = false;
    resizeStateRef.current = null;
    isMoveActiveRef.current = false;
    moveStateRef.current    = null;
    // Stop any sustained piano key note
    if (sustainedNoteStopRef.current) {
      sustainedNoteStopRef.current();
      sustainedNoteStopRef.current = null;
    }
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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

      if (e.code === 'Space') {
        if (inInput) return;
        e.preventDefault();
        if (isPlayingRef.current) stopPlayback(); else startPlayback();
        return;
      }

      // Tool shortcuts
      if (!inInput && !e.ctrlKey && !e.metaKey) {
        if (e.code === 'KeyS') { setTool('select'); return; }
        if (e.code === 'KeyD') { setTool('draw');   return; }
        if (e.code === 'KeyP') { setTool('paint');  return; }
      }

      if ((e.code === 'Delete' || e.code === 'Backspace') && !inInput) {
        const ids = selectedIdsRef.current;
        if (ids.size > 0) {
          e.preventDefault();
          setPattern(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => ({
              ...t, notes: t.notes.filter(n => !ids.has(n.id)),
            })),
          }));
          setSelectedIds(new Set<string>());
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !inInput) {
        if (e.code === 'KeyA') {
          e.preventDefault();
          const allIds = new Set<string>(
            patternRef.current.tracks.flatMap(t => t.notes.map(n => n.id))
          );
          setSelectedIds(allIds);
          return;
        }
        if (e.code === 'KeyC') {
          e.preventDefault();
          const ids = selectedIdsRef.current;
          const copied: ClipboardNote[] = [];
          patternRef.current.tracks.forEach(t => {
            t.notes.forEach(n => { if (ids.has(n.id)) copied.push({ trackId: t.id, note: { ...n } }); });
          });
          clipboardRef.current = copied;
          return;
        }
        if (e.code === 'KeyV') {
          e.preventDefault();
          const cb = clipboardRef.current;
          if (cb.length === 0) return;
          const minStep = Math.min(...cb.map(cn => cn.note.startStep));
          const maxEnd  = Math.max(...cb.map(cn => cn.note.startStep + cn.note.durationSteps));
          const offset  = maxEnd - minStep; // paste immediately after the copied block
          const newIds  = new Set<string>();
          setPattern(prev => {
            const total = prev.bars * prev.beatsPerBar * prev.stepsPerBeat;
            return {
              ...prev,
              tracks: prev.tracks.map(t => {
                const toPaste = cb.filter(cn => cn.trackId === t.id);
                if (toPaste.length === 0) return t;
                const newNotes = toPaste.map(cn => {
                  const newId = makeNoteId();
                  newIds.add(newId);
                  return { ...cn.note, id: newId, startStep: (cn.note.startStep - minStep + offset + minStep) % total };
                }).filter(n => n.startStep < total);
                return { ...t, notes: [...t.notes, ...newNotes] };
              }),
            };
          });
          // Use setTimeout so setPattern resolves before we set selection
          setTimeout(() => setSelectedIds(new Set<string>(newIds)), 0);
          return;
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [startPlayback, stopPlayback]);

  // ── Note / track callbacks ─────────────────────────────────────────────────

  const addNote = useCallback((trackId: string, pitch: number, step: number, duration = 1, noteId?: string) => {
    const id = noteId ?? makeNoteId();
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
        return { ...t, notes: [...t.notes, { id, pitch, startStep: step, durationSteps: duration, velocity: 100 }] };
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

  const startPreviewPitch = useCallback((track: Track, pitch: number) => {
    resumeAudio();
    // Stop any currently held note
    if (sustainedNoteStopRef.current) {
      sustainedNoteStopRef.current();
      sustainedNoteStopRef.current = null;
    }
    const shift = track.octaveOffset ?? 0;
    const stop = startSustainedNote(pitch + shift, track.waveform, track.volume, track.attack);
    sustainedNoteStopRef.current = stop;
  }, []);

  const stopPreviewPitch = useCallback(() => {
    if (sustainedNoteStopRef.current) {
      sustainedNoteStopRef.current();
      sustainedNoteStopRef.current = null;
    }
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
        volume: 1, attack: 0.01, release: 0.3, collapsed: false, octaveOffset: 0,
      };
      return { ...prev, tracks: [...prev.tracks, newTrack] };
    });
  }, []);

  const addDrumTrack = useCallback(() => {
    setPattern(prev => {
      const drumCount   = prev.tracks.filter(t => t.isDrum).length;
      const lastDrumIdx = prev.tracks.reduce((acc, t, i) => t.isDrum ? i : acc, -1);
      const newTrack: Track = {
        id: `d${makeNoteId()}`, name: `Drums ${drumCount + 1}`,
        color: TRACK_COLORS[(drumCount + 3) % TRACK_COLORS.length],
        waveform: 'sine', notes: [], muted: false, isDrum: true,
        volume: 1, attack: 0.01, release: 0.3, collapsed: false, octaveOffset: 0,
        drumRows: [...DEFAULT_DRUM_ROWS],
      };
      const tracks = [...prev.tracks];
      tracks.splice(lastDrumIdx + 1, 0, newTrack);
      return { ...prev, tracks };
    });
  }, []);

  const addDrumPiece = useCallback((trackId: string, pitch: number) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        const rows = t.drumRows?.length ? t.drumRows : [...DEFAULT_DRUM_ROWS];
        if (rows.includes(pitch)) return t;
        return { ...t, drumRows: [...rows, pitch] };
      }),
    }));
  }, []);

  const removeDrumPiece = useCallback((trackId: string, pitch: number) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        const rows = (t.drumRows?.length ? t.drumRows : [...DEFAULT_DRUM_ROWS]).filter(p => p !== pitch);
        return { ...t, drumRows: rows, notes: t.notes.filter(n => n.pitch !== pitch) };
      }),
    }));
  }, []);

  const newPattern = useCallback(() => {
    stopPlayback();
    setPattern(createInitialPattern());
  }, [stopPlayback]);

  // ── Select tool callbacks ──────────────────────────────────────────────────

  const selectNote = useCallback((noteId: string, addToSelection: boolean) => {
    setSelectedIds(prev => {
      const next = new Set<string>(prev);
      if (addToSelection) {
        if (next.has(noteId)) next.delete(noteId);
        else next.add(noteId);
      } else {
        next.clear();
        next.add(noteId);
      }
      return next;
    });
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set<string>());
  }, []);

  const startMove = useCallback((noteId: string, clientX: number, clientY: number) => {
    // Ensure the clicked note is selected, then record original positions for all selected
    setSelectedIds(prev => {
      const next = new Set<string>(prev);
      if (!next.has(noteId)) { next.clear(); next.add(noteId); }

      const notes = new Map<string, MoveNote>();
      patternRef.current.tracks.forEach(t => {
        t.notes.forEach(n => {
          if (next.has(n.id)) notes.set(n.id, { trackId: t.id, origPitch: n.pitch, origStep: n.startStep });
        });
      });
      moveStateRef.current    = { startClientX: clientX, startClientY: clientY, notes };
      isMoveActiveRef.current = true;

      return next;
    });
  }, []);

  // ── Window menus ───────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: 'File',
      items: [
        { label: 'New Pattern',        onClick: newPattern },
        { separator: true },
        { label: 'Save to Library…',   onClick: () => setShowSave(true) },
        { label: 'Load from Library…', onClick: () => setShowLoad(true) },
        { label: 'Download JSON',      onClick: () => downloadJson(patternRef.current) },
        ...(onQuit ? [{ separator: true as const }, { label: 'Close', onClick: onQuit }] : []),
      ],
    },
    {
      label: 'Track',
      items: [
        { label: 'Add Melody Track', onClick: addMelodicTrack },
        { label: 'Add Drum Track',   onClick: addDrumTrack },
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
  ], [isPlaying, startPlayback, stopPlayback, newPattern, addMelodicTrack, addDrumTrack, onQuit]);

  useWindowMenus(menus);

  // ── Render ─────────────────────────────────────────────────────────────────

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
        tool={tool}
        onPlay={startPlayback}
        onStop={stopPlayback}
        onBpmChange={bpm => setPattern(p => ({ ...p, bpm: Math.max(40, Math.min(240, bpm)) }))}
        onBarsChange={bars => { stopPlayback(); setPattern(p => ({ ...p, bars })); }}
        onStepsPerBeatChange={spb => { stopPlayback(); setPattern(p => ({ ...p, stepsPerBeat: spb })); }}
        onZoomIn={() => setZoomIdx(i => Math.min(i + 1, ZOOM_PRESETS.length - 1))}
        onZoomOut={() => setZoomIdx(i => Math.max(i - 1, 0))}
        onNew={newPattern}
        onToolChange={setTool}
      />

      {/* Main grid */}
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
              tool={tool}
              selectedIds={selectedIds}
              paintModeRef={paintModeRef}
              lastNoteDurationRef={lastNoteDurationRef}
              onToggleCollapse={() => toggleCollapse(track.id)}
              onGear={() => setModalTid(track.id)}
              onMute={() => muteTrack(track.id)}
              onAddNote={(pitch, step, duration, noteId) => addNote(track.id, pitch, step, duration, noteId)}
              onAddDrumNote={(pitch, step) => addNote(track.id, pitch, step)}
              onRemoveNote={noteId => removeNote(track.id, noteId)}
              onStartResize={(noteId, startX, origDur, noteStart) =>
                startResize(noteId, track.id, startX, origDur, noteStart)
              }
              onStartPreviewPitch={pitch => startPreviewPitch(track, pitch)}
              onStopPreviewPitch={stopPreviewPitch}
              onPreviewDrum={previewDrum}
              onAddDrumPiece={pitch => addDrumPiece(track.id, pitch)}
              onRemoveDrumPiece={pitch => removeDrumPiece(track.id, pitch)}
              onSelectNote={selectNote}
              onDeselectAll={deselectAll}
              onStartMove={startMove}
            />
          ))}

          {/* Add track row */}
          <div className="me-add-track-row" style={{ height: HDR_H }}>
            <div className="me-add-track-left" style={{ width: LEFT_W }}>
              <button className="me-btn me-btn--sm" onPointerDown={addMelodicTrack}>+ Melody</button>
            </div>
            <div className="me-add-track-fill" style={{ width: gridW }} />
          </div>

          {/* Playhead */}
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
          canDelete={pattern.tracks.length > 1}
          onSave={updates => { updateTrack(modalTrack.id, updates); setModalTid(null); }}
          onClose={() => setModalTid(null)}
          onDelete={() => { deleteTrack(modalTrack.id); setModalTid(null); }}
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
