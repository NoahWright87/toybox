import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useWindowMenus } from '../../components/Window/useWindowMenus';
import type { MenuBarMenu } from '../../components/MenuBar/MenuBar';
import {
  type Song, type Clip, type SongBlock, type Track, type Note,
  type DrumType, type OscWaveform, type EditTool, type AppView,
  DRUM_LABELS, DRUM_PITCHES, PIANO_MIN, PIANO_MAX,
  isBlackPitch, pitchName, makeNoteId, createInitialSong, TRACK_COLORS,
  drumPitchLabel, DEFAULT_DRUM_ROWS, GM_PROGRAMS, makeDefaultTracks,
} from './types';
import { resumeAudio, playNote, playDrum, loadSoundFont, isSoundFontReady, startSustainedNote } from './audio';
import SongView, { SONG_LEFT_W, SONG_BAR_W } from './SongView';
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

const LEFT_W  = 100;
const KEYS_W  = 40;
const RULER_H = 24;
const HDR_H   = 32;

const PITCH_RANGE: number[] = [];
for (let p = PIANO_MAX; p >= PIANO_MIN; p--) PITCH_RANGE.push(p);

const PITCH_TO_ROW = new Map<number, number>();
PITCH_RANGE.forEach((p, i) => PITCH_TO_ROW.set(p, i));

// ── Local types ────────────────────────────────────────────────────────────────

type PaintState   = { action: 'add' | 'remove'; trackId: string } | null;
type ResizeState  = { noteId: string; trackId: string; startX: number; origDuration: number; noteStartStep: number };
type MoveNote     = { trackId: string; origPitch: number; origStep: number };
type MoveState    = { startClientX: number; startClientY: number; notes: Map<string, MoveNote> };
type ClipboardNote = { trackId: string; note: Note };

interface SaveEntry { name: string; song?: Song; pattern?: unknown; savedAt: string }

// ── Song helpers ───────────────────────────────────────────────────────────────

function updateClipInSong(song: Song, clipId: string, fn: (c: Clip) => Clip): Song {
  return { ...song, clips: song.clips.map(c => c.id === clipId ? fn(c) : c) };
}

function updateTracksInClip(song: Song, clipId: string, fn: (tracks: Track[]) => Track[]): Song {
  return updateClipInSong(song, clipId, c => ({ ...c, tracks: fn(c.tracks) }));
}

// ── Storage ────────────────────────────────────────────────────────────────────

const STORAGE_AUTO  = 'midi-editor-pattern';
const STORAGE_SAVES = 'midi-editor-saves';
const STORAGE_ZOOM  = 'midi-editor-zoom';

function migrateTrack(t: Track): Track {
  const defaults: Partial<Track> = { volume: 1, attack: 0.01, release: 0.3, collapsed: false, octaveOffset: 0 };
  if (t.isDrum && !t.drumRows) defaults.drumRows = [...DEFAULT_DRUM_ROWS];
  return { ...defaults, ...t } as Track;
}

function migrateClip(c: Clip): Clip {
  return { ...c, tracks: c.tracks.map(migrateTrack) };
}

function migrateSong(raw: unknown): Song {
  const s = raw as Song;
  const defaults = { arrangementBars: 16, arrangement: [] };
  return { ...defaults, ...s, clips: s.clips.map(migrateClip) };
}

// Convert legacy Pattern → Song
function patternToSong(raw: unknown): Song {
  const p = raw as { bpm: number; bars: number; beatsPerBar: number; stepsPerBeat: number; tracks: Track[] };
  const clip: Clip = {
    id: makeNoteId(),
    name: 'Pattern A',
    color: '#5b2d8e',
    bars: p.bars ?? 2,
    tracks: (p.tracks ?? []).map(migrateTrack),
  };
  return {
    bpm: p.bpm ?? 120,
    beatsPerBar: p.beatsPerBar ?? 4,
    stepsPerBeat: p.stepsPerBeat ?? 4,
    clips: [clip],
    arrangement: [],
    arrangementBars: 16,
  };
}

function loadSong(): Song {
  try {
    const raw = localStorage.getItem(STORAGE_AUTO);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.clips) return migrateSong(parsed);
      return patternToSong(parsed);
    }
  } catch { /* ignore */ }
  return createInitialSong();
}

function loadZoomIdx(): number {
  try { return Number(localStorage.getItem(STORAGE_ZOOM)) || DEFAULT_ZOOM; } catch { return DEFAULT_ZOOM; }
}

function getSaves(): SaveEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_SAVES) || '[]'); } catch { return []; }
}

function persistSave(name: string, song: Song) {
  const saves = getSaves().filter(s => s.name !== name);
  saves.unshift({ name, song, savedAt: new Date().toISOString() });
  try { localStorage.setItem(STORAGE_SAVES, JSON.stringify(saves.slice(0, 20))); } catch { /* ignore */ }
}

function deleteSave(name: string) {
  const saves = getSaves().filter(s => s.name !== name);
  try { localStorage.setItem(STORAGE_SAVES, JSON.stringify(saves)); } catch { /* ignore */ }
}

function loadSaveEntry(entry: SaveEntry): Song {
  if (entry.song) return migrateSong(entry.song);
  if (entry.pattern) return patternToSong(entry.pattern);
  return createInitialSong();
}

function downloadJson(song: Song) {
  const blob = new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'midi-song.json'; a.click();
  URL.revokeObjectURL(url);
}

// ── Build note map ──────────────────────────────────────────────────────────────

function buildNoteMap(track: Track): Map<string, string> {
  const m = new Map<string, string>();
  track.notes.forEach(n => {
    for (let d = 0; d < n.durationSteps; d++) m.set(`${n.pitch},${n.startStep + d}`, n.id);
  });
  return m;
}

// ── Instrument modal ────────────────────────────────────────────────────────────

interface InstrumentModalProps {
  track: Track;
  canDelete: boolean;
  onSave: (updates: Partial<Track>) => void;
  onApply: (updates: Partial<Track>) => void;
  onClose: () => void;
  onDelete: () => void;
}

const GM_GROUPS = [
  { label: 'Piano',      start: 0   }, { label: 'Chr Perc', start: 8   },
  { label: 'Organ',      start: 16  }, { label: 'Guitar',   start: 24  },
  { label: 'Bass',       start: 32  }, { label: 'Strings',  start: 40  },
  { label: 'Ensemble',   start: 48  }, { label: 'Brass',    start: 56  },
  { label: 'Reed',       start: 64  }, { label: 'Pipe',     start: 72  },
  { label: 'Synth Lead', start: 80  }, { label: 'Synth Pad',start: 88  },
  { label: 'Synth FX',   start: 96  }, { label: 'Ethnic',   start: 104 },
  { label: 'Percussive', start: 112 }, { label: 'Sound FX', start: 120 },
];

function InstrumentModal({ track, canDelete, onSave, onApply, onClose, onDelete }: InstrumentModalProps) {
  const [name,         setName]         = useState(track.name);
  const [color,        setColor]        = useState(track.color);
  const [waveform,     setWaveform]     = useState(track.waveform);
  const [volume,       setVolume]       = useState(Math.round(track.volume * 100));
  const [sfMode,       setSfMode]       = useState(track.gmProgram !== undefined);
  const [gmProg,       setGmProg]       = useState(track.gmProgram ?? 0);
  const [octaveOffset, setOctaveOffset] = useState(track.octaveOffset ?? 0);

  // Keep a ref so applyWith can compose the full update using current values
  const pbRef = useRef({ waveform, sfMode, gmProg, volume, octaveOffset });
  pbRef.current = { waveform, sfMode, gmProg, volume, octaveOffset };

  function applyWith(patch: Partial<{ waveform: OscWaveform; sfMode: boolean; gmProg: number; volume: number; octaveOffset: number }>) {
    const m = { ...pbRef.current, ...patch };
    onApply({ waveform: m.waveform, volume: m.volume / 100, gmProgram: m.sfMode ? m.gmProg : undefined, octaveOffset: m.octaveOffset });
  }

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
    if (nextGroup && prog >= nextGroup.start) groupIdx++;
    if (prog === GM_GROUPS[groupIdx].start) gmRows.push({ type: 'group', label: GM_GROUPS[groupIdx].label });
    gmRows.push({ type: 'inst', prog, label: GM_PROGRAMS[prog] });
  }

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
            <input className="me-text-input" value={name} onChange={e => setName(e.target.value)} maxLength={16} />
          </div>
          <div className="me-modal__row">
            <label className="me-label">COLOR</label>
            <div className="me-color-swatches">
              {TRACK_COLORS.map(c => (
                <button key={c} className={`me-color-swatch${c === color ? ' me-color-swatch--active' : ''}`}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
          {!track.isDrum && (
            <>
              <div className="me-modal__row">
                <label className="me-label">SOURCE</label>
                <div className="me-source-toggle">
                  <button className={`me-source-btn${!sfMode ? ' me-source-btn--active' : ''}`} onClick={() => { setSfMode(false); applyWith({ sfMode: false }); }}>OSC</button>
                  <button className={`me-source-btn${sfMode ? ' me-source-btn--active' : ''}`} onClick={() => { setSfMode(true); applyWith({ sfMode: true }); }}>MIDI{!isSoundFontReady() ? '…' : ''}</button>
                </div>
              </div>
              {!sfMode && (
                <div className="me-modal__row">
                  <label className="me-label">WAVE</label>
                  <select className="me-select" value={waveform} onChange={e => { const w = e.target.value as OscWaveform; setWaveform(w); applyWith({ waveform: w }); }}>
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
                        : <button key={row.prog} className={`me-inst-item${row.prog === gmProg ? ' me-inst-item--active' : ''}`}
                            onClick={() => { setGmProg(row.prog); applyWith({ gmProg: row.prog }); }}>{row.label}</button>
                    )}
                  </div>
                </div>
              )}
              <div className="me-modal__row">
                <label className="me-label">OCTAVE</label>
                <div className="me-octave-btns">
                  {[-3,-2,-1,0,1,2,3].map(v => (
                    <button key={v} className={`me-btn me-btn--sm${octaveOffset === v ? ' me-btn--primary' : ''}`}
                      onClick={() => { setOctaveOffset(v); applyWith({ octaveOffset: v }); }}>{v > 0 ? `+${v}` : `${v}`}</button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="me-modal__row">
            <label className="me-label">VOL {volume}%</label>
            <input type="range" min={0} max={100} value={volume} onChange={e => { const v = Number(e.target.value); setVolume(v); applyWith({ volume: v }); }} className="me-slider" />
          </div>
          <div className="me-modal__row">
            <label className="me-label">PREVIEW</label>
            <button className="me-btn me-btn--sm" onClick={previewSound}>Play</button>
          </div>
        </div>
        <div className="me-modal__footer">
          {canDelete && <button className="me-btn me-btn--sm me-btn--danger" onClick={onDelete}>Delete Track</button>}
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
  const [name, setName] = useState('My Song');
  const saves = getSaves();
  return (
    <div className="me-modal-backdrop" onPointerDown={onClose}>
      <div className="me-modal" onPointerDown={e => e.stopPropagation()}>
        <div className="me-modal__title">
          <span>💾 Save Song</span>
          <button className="me-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="me-modal__body">
          <div className="me-modal__row">
            <label className="me-label">NAME</label>
            <input className="me-text-input" value={name} onChange={e => setName(e.target.value)} maxLength={32} autoFocus />
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

interface LoadDialogProps { onLoad: (s: Song) => void; onClose: () => void }
function LoadDialog({ onLoad, onClose }: LoadDialogProps) {
  const [saves, setSaves] = useState(getSaves);
  return (
    <div className="me-modal-backdrop" onPointerDown={onClose}>
      <div className="me-modal" onPointerDown={e => e.stopPropagation()}>
        <div className="me-modal__title">
          <span>📂 Load Song</span>
          <button className="me-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="me-modal__body">
          {saves.length === 0
            ? <p className="me-label me-label--dim">No saved songs.</p>
            : (
              <div className="me-save-list">
                {saves.map(s => (
                  <div key={s.name} className="me-save-item me-save-item--load">
                    <button className="me-btn me-btn--sm" onClick={() => onLoad(loadSaveEntry(s))}>Load</button>
                    <span>{s.name}</span>
                    <span className="me-label--dim">{s.savedAt.slice(0, 10)}</span>
                    <button className="me-btn me-btn--sm me-btn--danger" onClick={() => { deleteSave(s.name); setSaves(getSaves()); }}>✕</button>
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
  song: Song;
  selectedClipId: string;
  isPlaying: boolean;
  zoomIdx: number;
  tool: EditTool;
  view: AppView;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onBarsChange: (bars: number) => void;
  onStepsPerBeatChange: (spb: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onNew: () => void;
  onToolChange: (t: EditTool) => void;
  onViewChange: (v: AppView) => void;
  onSelectClip: (clipId: string) => void;
}

function Transport({
  song, selectedClipId, isPlaying, zoomIdx, tool, view,
  onPlay, onStop, onBpmChange, onBarsChange, onStepsPerBeatChange,
  onZoomIn, onZoomOut, onNew, onToolChange, onViewChange, onSelectClip,
}: TransportProps) {
  function nudge(delta: number) { onBpmChange(Math.max(40, Math.min(240, song.bpm + delta))); }

  const selectedClip = song.clips.find(c => c.id === selectedClipId) ?? song.clips[0];
  const TOOLS: { key: EditTool; label: string }[] = [
    { key: 'select', label: 'SEL' },
    { key: 'draw',   label: 'DRAW' },
    { key: 'paint',  label: 'PAINT' },
  ];

  return (
    <div className="me-transport">
      <div className="me-transport__row">
        <button className={`me-btn me-btn--play${isPlaying ? ' me-btn--stop' : ''}`} onPointerDown={isPlaying ? onStop : onPlay}>
          {isPlaying ? '■' : '▶'}
        </button>

        {/* View toggle */}
        <div className="me-tool-group">
          <button className={`me-btn me-btn--sm${view === 'pattern' ? ' me-btn--primary' : ''}`}
            onPointerDown={() => onViewChange('pattern')} title="Pattern editor">PAT</button>
          <button className={`me-btn me-btn--sm${view === 'song' ? ' me-btn--primary' : ''}`}
            onPointerDown={() => onViewChange('song')} title="Song arrangement">SONG</button>
        </div>

        {view === 'pattern' && (
          <>
            <div className="me-transport__sep" />
            {/* Clip selector */}
            <div className="me-transport__group">
              <span className="me-label">CLIP</span>
              <select className="me-select" value={selectedClipId} onChange={e => onSelectClip(e.target.value)}>
                {song.clips.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="me-transport__sep" />

            {/* Tools */}
            <div className="me-tool-group">
              {TOOLS.map(t => (
                <button key={t.key} className={`me-btn me-btn--sm${tool === t.key ? ' me-btn--primary' : ''}`}
                  onPointerDown={() => onToolChange(t.key)}>{t.label}</button>
              ))}
            </div>

            <div className="me-transport__sep" />

            <div className="me-transport__group">
              <span className="me-label">BARS</span>
              <select className="me-select" value={selectedClip?.bars ?? 2} onChange={e => onBarsChange(Number(e.target.value))}>
                {[1,2,4,8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="me-transport__group">
              <span className="me-label">GRID</span>
              <select className="me-select" value={song.stepsPerBeat} onChange={e => onStepsPerBeatChange(Number(e.target.value))}>
                <option value={2}>1/8</option>
                <option value={4}>1/16</option>
              </select>
            </div>

            <div className="me-transport__sep" />

            <div className="me-transport__group">
              <span className="me-label">ZOOM</span>
              <button className="me-btn me-btn--sm" onPointerDown={onZoomOut} disabled={zoomIdx <= 0}>−</button>
              <button className="me-btn me-btn--sm" onPointerDown={onZoomIn} disabled={zoomIdx >= ZOOM_PRESETS.length - 1}>+</button>
            </div>
          </>
        )}

        <div className="me-transport__sep" />

        <div className="me-transport__group">
          <span className="me-label">BPM</span>
          <button className="me-btn me-btn--sm" onPointerDown={() => nudge(-5)}>−</button>
          <input className="me-num-input" type="number" min={40} max={240} value={song.bpm}
            onChange={e => onBpmChange(Number(e.target.value))} />
          <button className="me-btn me-btn--sm" onPointerDown={() => nudge(5)}>+</button>
        </div>

        <div className="me-transport__sep" />

        <button className="me-btn me-btn--sm" onPointerDown={onNew} title={view === 'pattern' ? 'New blank clip' : 'New blank song'}>NEW</button>

        <span className="me-label me-label--dim">SPC=play{view === 'pattern' ? ' S/D/P=tool' : ''}</span>
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
  const noteMap   = useMemo(() => buildNoteMap(track), [track]);
  const gridW     = totalSteps * stepW;
  const gridH     = PITCH_RANGE.length * rowH;
  const noteRects = useMemo(() => track.notes.filter(n => n.startStep < totalSteps), [track.notes, totalSteps]);

  function cellDown(pitch: number, step: number, e: React.PointerEvent) {
    if (tool === 'select') { onDeselectAll(); return; }
    const existingId = noteMap.get(`${pitch},${step}`);
    if (existingId) {
      paintModeRef.current = { action: 'remove', trackId: track.id };
      onRemoveNote(existingId);
    } else if (tool === 'draw') {
      const dur = lastNoteDurationRef.current;
      const newId = makeNoteId();
      onAddNote(pitch, step, dur, newId);
      onPreviewPitch(pitch);
      onStartResize(newId, e.clientX, dur, step);
    } else {
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
      {Array.from({ length: totalSteps }, (_, s) => {
        const isBar  = s % (stepsPerBeat * beatsPerBar) === 0;
        const isBeat = !isBar && s % stepsPerBeat === 0;
        const isQ4   = !isBar && !isBeat && s % 4 === 0;
        return (
          <div key={`sc-${s}`}
            className={`me-step-col${isBar?' me-step-col--bar':isBeat?' me-step-col--beat':isQ4?' me-step-col--q4':''}`}
            style={{ left: s * stepW, width: stepW, height: gridH }}
          />
        );
      })}
      {PITCH_RANGE.map((pitch, rowIdx) => {
        const isBlack = isBlackPitch(pitch);
        return Array.from({ length: totalSteps }, (_, step) => {
          if (noteMap.has(`${pitch},${step}`)) return null;
          const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
          const isBeat = !isBar && step % stepsPerBeat === 0;
          return (
            <div
              key={`bg-${pitch}-${step}`}
              className={`me-cell ${isBlack ? 'me-cell--black' : 'me-cell--white'}${isBar?' me-cell--bar':isBeat?' me-cell--beat':''}`}
              style={{ left: step * stepW, top: rowIdx * rowH, width: stepW, height: rowH }}
              data-pitch={pitch} data-step={step} data-track-id={track.id}
              onPointerDown={(e: React.PointerEvent) => { e.preventDefault(); cellDown(pitch, step, e); }}
            />
          );
        });
      })}
      {noteRects.map(note => {
        const rowIdx = PITCH_TO_ROW.get(note.pitch);
        if (rowIdx === undefined) return null;
        const displayDur = Math.min(note.durationSteps, totalSteps - note.startStep);
        const isSelected = selectedIds.has(note.id);
        return (
          <div
            key={note.id}
            className={`me-note-rect${isSelected ? ' me-note-rect--selected' : ''}`}
            style={{ left: note.startStep * stepW, top: rowIdx * rowH, width: displayDur * stepW, height: rowH, background: track.color }}
            data-note-id={note.id} data-track-id={track.id}
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
  const drumNoteMap    = useMemo(() => buildNoteMap(track), [track]);
  const activeDrumRows = track.drumRows?.length ? track.drumRows : DEFAULT_DRUM_ROWS;
  const gridW          = totalSteps * stepW;
  const gridH          = activeDrumRows.length * rowH;
  const editActive     = tool !== 'select';

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
      {Array.from({ length: totalSteps }, (_, s) => {
        const isBar  = s % (stepsPerBeat * beatsPerBar) === 0;
        const isBeat = !isBar && s % stepsPerBeat === 0;
        const isQ4   = !isBar && !isBeat && s % 4 === 0;
        return (
          <div key={`ds-${s}`}
            className={`me-step-col${isBar?' me-step-col--bar':isBeat?' me-step-col--beat':isQ4?' me-step-col--q4':''}`}
            style={{ left: s * stepW, width: stepW, height: gridH }}
          />
        );
      })}
      {activeDrumRows.map((pitch, rowIdx) => (
        Array.from({ length: totalSteps }, (_, step) => {
          const existingId = drumNoteMap.get(`${pitch},${step}`);
          const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
          const isBeat = !isBar && step % stepsPerBeat === 0;
          return (
            <div
              key={`dcell-${pitch}-${step}`}
              className={`me-drum-cell${existingId?' me-drum-cell--on':''}${isBar?' me-drum-cell--bar':isBeat?' me-drum-cell--beat':''}`}
              style={{ left: step * stepW, top: rowIdx * rowH, width: stepW, height: rowH,
                ...((existingId ? { '--drum-color': track.color } : {}) as React.CSSProperties) }}
              data-drum-pitch={pitch} data-step={step} data-track-id={track.id} data-note-id={existingId ?? ''}
              onContextMenu={(e: React.MouseEvent) => { if (existingId) { e.preventDefault(); onRemoveNote(existingId); } }}
              {...(editActive ? { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); cellDown(pitch, step, existingId); } } : {})}
            />
          );
        })
      ))}
    </div>
  );
}

// ── Track section ─────────────────────────────────────────────────────────────

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
  const contentH = track.isDrum ? activeDrumRows.length * rowH : PITCH_RANGE.length * rowH;

  const availablePieces = (Object.keys(DRUM_PITCHES) as DrumType[])
    .filter(dt => !activeDrumRows.includes(DRUM_PITCHES[dt]));

  return (
    <div className="me-track-section" style={{ '--tcolor': track.color } as React.CSSProperties}>
      <div className="me-track-header-row" style={{ height: HDR_H }}>
        <div className="me-track-header-left" style={{ width: LEFT_W }}>
          <button className="me-track-collapse" onPointerDown={onToggleCollapse}>{track.collapsed ? '▶' : '▼'}</button>
          <span className="me-track-color-dot" style={{ background: track.color }} />
          <span className="me-track-name">{track.name}</span>
          <div className="me-track-header-btns">
            <button className={`me-mute-btn${track.muted ? ' me-mute-btn--muted' : ''}`} onPointerDown={onMute}>M</button>
            <button className="me-btn me-btn--sm me-btn--edit" onPointerDown={onGear}>EDIT</button>
          </div>
        </div>
        <div className="me-track-header-fill" style={{ width: gridW, background: track.color + '18' }} />
      </div>

      {!track.collapsed && (
        <>
          <div className="me-track-content">
            <div className="me-track-left" style={{ width: LEFT_W, height: contentH }}>
              <div className="me-track-color-strip" style={{ background: track.color + '28' }} />
              <div className="me-track-keys-col" style={{ width: KEYS_W }}>
                {track.isDrum
                  ? activeDrumRows.map(pitch => (
                      <div key={pitch} className="me-drum-key" style={{ height: rowH }} onPointerDown={() => onPreviewDrum(pitch)}>
                        <span>{drumPitchLabel(pitch)}</span>
                        <button className="me-drum-row-remove" onPointerDown={e => { e.stopPropagation(); onRemoveDrumPiece(pitch); }}>×</button>
                      </div>
                    ))
                  : PITCH_RANGE.map(pitch => {
                      const isBlack = isBlackPitch(pitch);
                      const isC     = pitch % 12 === 0;
                      return (
                        <div key={pitch} className={`me-key ${isBlack ? 'me-key--black' : 'me-key--white'}`}
                          style={{ height: rowH }}
                          onPointerDown={() => onStartPreviewPitch(pitch)}
                          onPointerEnter={e => { if (e.buttons === 1) onStartPreviewPitch(pitch); }}
                          onPointerUp={onStopPreviewPitch}
                        >
                          {isC && <span className="me-key__label">{pitchName(pitch)}</span>}
                        </div>
                      );
                    })}
              </div>
            </div>

            {track.isDrum
              ? <DrumGrid track={track} totalSteps={totalSteps} stepsPerBeat={stepsPerBeat} beatsPerBar={beatsPerBar}
                  stepW={stepW} rowH={rowH} tool={tool} paintModeRef={paintModeRef}
                  onAddNote={onAddDrumNote} onRemoveNote={onRemoveNote} onPreviewDrum={onPreviewDrum} />
              : <MelodicGrid track={track} totalSteps={totalSteps} stepsPerBeat={stepsPerBeat} beatsPerBar={beatsPerBar}
                  stepW={stepW} rowH={rowH} tool={tool} selectedIds={selectedIds}
                  paintModeRef={paintModeRef} lastNoteDurationRef={lastNoteDurationRef}
                  onAddNote={onAddNote} onRemoveNote={onRemoveNote} onStartResize={onStartResize}
                  onPreviewPitch={onStartPreviewPitch}
                  onSelectNote={onSelectNote} onDeselectAll={onDeselectAll} onStartMove={onStartMove} />
            }
          </div>

          {track.isDrum && (
            <div className="me-drum-add-piece-row" style={{ height: HDR_H }}>
              <div className="me-drum-add-piece-left" style={{ width: LEFT_W }}>
                <div style={{ position: 'relative' }}>
                  <button className="me-btn me-btn--sm" onPointerDown={() => setShowAddPiece(v => !v)}
                    disabled={availablePieces.length === 0}>+ Piece</button>
                  {showAddPiece && (
                    <div className="me-drum-piece-menu">
                      {availablePieces.map(dt => (
                        <button key={dt} className="me-drum-piece-option"
                          onPointerDown={() => { onAddDrumPiece(DRUM_PITCHES[dt]); setShowAddPiece(false); }}>
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
  const [song,          setSong]          = useState<Song>(loadSong);
  const [selectedClipId,setSelectedClipId]= useState<string>(() => loadSong().clips[0]?.id ?? '');
  const [view,          setView]          = useState<AppView>('pattern');
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [zoomIdx,       setZoomIdx]       = useState(loadZoomIdx);
  const [tool,          setTool]          = useState<EditTool>('paint');
  const [modalTid,      setModalTid]      = useState<string | null>(null);
  const modalOrigRef = useRef<Partial<Track> | null>(null);
  const [showSave,      setShowSave]      = useState(false);
  const [showLoad,      setShowLoad]      = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set<string>());

  const selectedClip = song.clips.find(c => c.id === selectedClipId) ?? song.clips[0];

  const { stepW, rowH } = ZOOM_PRESETS[zoomIdx];

  const songRef           = useRef(song);
  songRef.current         = song;
  const selectedClipIdRef = useRef(selectedClipId);
  selectedClipIdRef.current = selectedClipId;
  const viewRef           = useRef<AppView>('pattern');
  viewRef.current         = view;
  const stepWRef          = useRef(stepW);
  stepWRef.current        = stepW;
  const rowHRef           = useRef(rowH);
  rowHRef.current         = rowH;
  const selectedIdsRef    = useRef<Set<string>>(new Set<string>());
  selectedIdsRef.current  = selectedIds;

  const isPlayingRef   = useRef(false);
  const stepRef        = useRef(0);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playheadRef    = useRef<HTMLDivElement | null>(null);

  const paintModeRef       = useRef<PaintState>(null);
  const resizeModeRef      = useRef(false);
  const resizeStateRef     = useRef<ResizeState | null>(null);
  const lastNoteDurationRef = useRef<number>(1);
  const sustainedNoteStopRef = useRef<(() => void) | null>(null);
  const isMoveActiveRef    = useRef(false);
  const moveStateRef       = useRef<MoveState | null>(null);
  const clipboardRef       = useRef<ClipboardNote[]>([]);

  const totalSteps = useMemo(
    () => (selectedClip?.bars ?? 2) * song.beatsPerBar * song.stepsPerBeat,
    [selectedClip?.bars, song.beatsPerBar, song.stepsPerBeat],
  );
  const gridW = totalSteps * stepW;

  // ── Auto-save ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try { localStorage.setItem(STORAGE_AUTO, JSON.stringify(song)); } catch { /* ignore */ }
  }, [song]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_ZOOM, String(zoomIdx)); } catch { /* ignore */ }
  }, [zoomIdx]);

  // ── Playback ───────────────────────────────────────────────────────────────

  function movePlayhead(step: number) {
    if (!playheadRef.current) return;
    const s = songRef.current;
    let x: number;
    if (viewRef.current === 'pattern') {
      x = LEFT_W + step * stepWRef.current;
    } else {
      const stepsPerBar = s.beatsPerBar * s.stepsPerBeat;
      x = SONG_LEFT_W + (step / stepsPerBar) * SONG_BAR_W;
    }
    playheadRef.current.style.display   = 'block';
    playheadRef.current.style.transform = `translateX(${x}px)`;
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
    const s    = songRef.current;
    const step = stepRef.current;
    const stepDur = 60 / s.bpm / s.stepsPerBeat;
    movePlayhead(step);

    if (viewRef.current === 'pattern') {
      // Play selected clip, looped
      const clip = s.clips.find(c => c.id === selectedClipIdRef.current) ?? s.clips[0];
      const clipTotalSteps = clip.bars * s.beatsPerBar * s.stepsPerBeat;
      const localStep = step % clipTotalSteps;
      clip.tracks.forEach(track => {
        if (track.muted) return;
        const shift = track.octaveOffset ?? 0;
        track.notes.forEach((note: Note) => {
          if (note.startStep !== localStep || note.startStep >= clipTotalSteps) return;
          if (track.isDrum) playDrum(note.pitch, note.velocity);
          else playNote(note.pitch + shift, note.velocity, note.durationSteps * stepDur,
            track.waveform, undefined, track.volume, track.attack, track.release, track.gmProgram);
        });
      });
      stepRef.current = (step + 1) % clipTotalSteps;
    } else {
      // Song mode: fire notes from all active blocks
      const stepsPerBar    = s.beatsPerBar * s.stepsPerBeat;
      const totalSongSteps = s.arrangementBars * stepsPerBar;
      const globalBar      = Math.floor(step / stepsPerBar);

      s.arrangement.forEach(block => {
        const clip = s.clips.find(c => c.id === block.clipId);
        if (!clip) return;
        if (globalBar < block.startBar || globalBar >= block.startBar + clip.bars) return;
        const localStep = step - block.startBar * stepsPerBar;
        clip.tracks.forEach(track => {
          if (track.muted) return;
          const shift = track.octaveOffset ?? 0;
          track.notes.forEach((note: Note) => {
            if (note.startStep !== localStep) return;
            if (track.isDrum) playDrum(note.pitch, note.velocity);
            else playNote(note.pitch + shift, note.velocity, note.durationSteps * stepDur,
              track.waveform, undefined, track.volume, track.attack, track.release, track.gmProgram);
          });
        });
      });

      const nextStep = step + 1;
      if (nextStep >= totalSongSteps) {
        // End of arrangement — stop
        isPlayingRef.current = false;
        timerRef.current = null;
        stepRef.current = 0;
        setIsPlaying(false);
        hidePlayhead();
        return;
      }
      stepRef.current = nextStep;
    }

    timerRef.current = setTimeout(tick, (60_000 / s.bpm) / s.stepsPerBeat);
  }, []);

  const startPlayback = useCallback(() => {
    resumeAudio();
    isPlayingRef.current = true;
    stepRef.current = 0;
    setIsPlaying(true);
    timerRef.current = setTimeout(tick, (60_000 / songRef.current.bpm) / songRef.current.stepsPerBeat);
  }, [tick]);

  useEffect(() => () => { stopPlayback(); }, [stopPlayback]);

  useEffect(() => { loadSoundFont('/TimGM6mb.sf2').catch(() => { /* non-fatal */ }); }, []);

  // ── Global pointer events ──────────────────────────────────────────────────

  const pointerMoveHandlerRef = useRef<(e: PointerEvent) => void>(() => {});
  const pointerUpHandlerRef   = useRef<(e: PointerEvent) => void>(() => {});

  pointerMoveHandlerRef.current = (e: PointerEvent) => {
    if (resizeModeRef.current && resizeStateRef.current) {
      const { noteId, trackId, startX, origDuration, noteStartStep } = resizeStateRef.current;
      const s      = songRef.current;
      const clip   = s.clips.find(c => c.id === selectedClipIdRef.current) ?? s.clips[0];
      const maxDur = clip.bars * s.beatsPerBar * s.stepsPerBeat - noteStartStep;
      const newDur = Math.max(1, Math.min(maxDur, origDuration + Math.round((e.clientX - startX) / stepWRef.current)));
      setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
        tracks.map(t => t.id !== trackId ? t : {
          ...t, notes: t.notes.map(n => n.id !== noteId ? n : { ...n, durationSteps: newDur }),
        })
      ));
      return;
    }

    if (isMoveActiveRef.current && moveStateRef.current) {
      const ms = moveStateRef.current;
      const stepDelta  = Math.round((e.clientX - ms.startClientX) / stepWRef.current);
      const pitchDelta = -Math.round((e.clientY - ms.startClientY) / rowHRef.current);
      const s     = songRef.current;
      const clip  = s.clips.find(c => c.id === selectedClipIdRef.current) ?? s.clips[0];
      const total = clip.bars * s.beatsPerBar * s.stepsPerBeat;
      setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
        tracks.map(t => ({
          ...t,
          notes: t.notes.map(n => {
            const orig = ms.notes.get(n.id);
            if (!orig || orig.trackId !== t.id) return n;
            return {
              ...n,
              pitch:     Math.max(PIANO_MIN, Math.min(PIANO_MAX, orig.origPitch + pitchDelta)),
              startStep: Math.max(0, Math.min(total - n.durationSteps, orig.origStep + stepDelta)),
            };
          }),
        }))
      ));
      return;
    }

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
          setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
            tracks.map(t => {
              if (t.id !== pm.trackId) return t;
              if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
              return { ...t, notes: [...t.notes, { id: makeNoteId(), pitch, startStep: step, durationSteps: dur, velocity: 100 }] };
            })
          ));
        }
        return;
      }
      const drumCell = el.closest('[data-drum-pitch]') as HTMLElement | null;
      if (drumCell && drumCell.dataset.trackId === pm.trackId && !drumCell.classList.contains('me-drum-cell--on')) {
        const pitch = parseInt(drumCell.dataset.drumPitch ?? '');
        const step  = parseInt(drumCell.dataset.step      ?? '');
        if (!isNaN(pitch) && !isNaN(step)) {
          setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
            tracks.map(t => {
              if (t.id !== pm.trackId) return t;
              if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
              return { ...t, notes: [...t.notes, { id: makeNoteId(), pitch, startStep: step, durationSteps: 1, velocity: 100 }] };
            })
          ));
        }
      }
    } else {
      const noteRect = el.closest('[data-note-id]') as HTMLElement | null;
      if (noteRect && noteRect.dataset.trackId === pm.trackId) {
        const noteId = noteRect.dataset.noteId ?? '';
        if (noteId) {
          setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
            tracks.map(t => t.id !== pm.trackId ? t : { ...t, notes: t.notes.filter(n => n.id !== noteId) })
          ));
        }
      }
    }
  };

  pointerUpHandlerRef.current = (_e: PointerEvent) => {
    if (resizeModeRef.current && resizeStateRef.current) {
      const { noteId, trackId } = resizeStateRef.current;
      const clip = songRef.current.clips.find(c => c.id === selectedClipIdRef.current) ?? songRef.current.clips[0];
      const note = clip?.tracks.find(t => t.id === trackId)?.notes.find(n => n.id === noteId);
      if (note) lastNoteDurationRef.current = note.durationSteps;
    }
    paintModeRef.current    = null;
    resizeModeRef.current   = false;
    resizeStateRef.current  = null;
    isMoveActiveRef.current = false;
    moveStateRef.current    = null;
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
      const tag     = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

      if (e.code === 'Space') {
        if (inInput) return;
        e.preventDefault();
        if (isPlayingRef.current) stopPlayback(); else startPlayback();
        return;
      }
      if (!inInput && !e.ctrlKey && !e.metaKey) {
        if (e.code === 'KeyS') { setTool('select'); return; }
        if (e.code === 'KeyD') { setTool('draw');   return; }
        if (e.code === 'KeyP') { setTool('paint');  return; }
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && !inInput) {
        const ids = selectedIdsRef.current;
        if (ids.size > 0) {
          e.preventDefault();
          setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
            tracks.map(t => ({ ...t, notes: t.notes.filter(n => !ids.has(n.id)) }))
          ));
          setSelectedIds(new Set<string>());
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !inInput) {
        if (e.code === 'KeyA') {
          e.preventDefault();
          const clip = songRef.current.clips.find(c => c.id === selectedClipIdRef.current) ?? songRef.current.clips[0];
          setSelectedIds(new Set<string>(clip?.tracks.flatMap(t => t.notes.map(n => n.id)) ?? []));
          return;
        }
        if (e.code === 'KeyC') {
          e.preventDefault();
          const ids  = selectedIdsRef.current;
          const clip = songRef.current.clips.find(c => c.id === selectedClipIdRef.current) ?? songRef.current.clips[0];
          const copied: ClipboardNote[] = [];
          clip?.tracks.forEach(t => { t.notes.forEach(n => { if (ids.has(n.id)) copied.push({ trackId: t.id, note: { ...n } }); }); });
          clipboardRef.current = copied;
          return;
        }
        if (e.code === 'KeyV') {
          e.preventDefault();
          const cb = clipboardRef.current;
          if (cb.length === 0) return;
          const minStep = Math.min(...cb.map(cn => cn.note.startStep));
          const maxEnd  = Math.max(...cb.map(cn => cn.note.startStep + cn.note.durationSteps));
          const offset  = maxEnd - minStep;
          const newIds  = new Set<string>();
          setSong(prev => {
            const clip  = prev.clips.find(c => c.id === selectedClipIdRef.current) ?? prev.clips[0];
            const total = clip.bars * prev.beatsPerBar * prev.stepsPerBeat;
            return updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
              tracks.map(t => {
                const toPaste = cb.filter(cn => cn.trackId === t.id);
                if (toPaste.length === 0) return t;
                const newNotes = toPaste.map(cn => {
                  const newId = makeNoteId();
                  newIds.add(newId);
                  return { ...cn.note, id: newId, startStep: (cn.note.startStep - minStep + offset + minStep) % total };
                }).filter(n => n.startStep < total);
                return { ...t, notes: [...t.notes, ...newNotes] };
              })
            );
          });
          setTimeout(() => setSelectedIds(new Set<string>(newIds)), 0);
          return;
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [startPlayback, stopPlayback]);

  // ── Note/track callbacks (pattern view) ────────────────────────────────────

  const addNote = useCallback((trackId: string, pitch: number, step: number, duration = 1, noteId?: string) => {
    const id = noteId ?? makeNoteId();
    setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
      tracks.map(t => {
        if (t.id !== trackId) return t;
        if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
        return { ...t, notes: [...t.notes, { id, pitch, startStep: step, durationSteps: duration, velocity: 100 }] };
      })
    ));
  }, []);

  const removeNote = useCallback((trackId: string, noteId: string) => {
    setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
      tracks.map(t => t.id !== trackId ? t : { ...t, notes: t.notes.filter(n => n.id !== noteId) })
    ));
  }, []);

  const startResize = useCallback((noteId: string, trackId: string, startX: number, origDuration: number, noteStartStep: number) => {
    resizeModeRef.current  = true;
    resizeStateRef.current = { noteId, trackId, startX, origDuration, noteStartStep };
  }, []);

  const startPreviewPitch = useCallback((track: Track, pitch: number) => {
    resumeAudio();
    if (sustainedNoteStopRef.current) { sustainedNoteStopRef.current(); sustainedNoteStopRef.current = null; }
    const stop = startSustainedNote(pitch + (track.octaveOffset ?? 0), track.waveform, track.volume, track.attack);
    sustainedNoteStopRef.current = stop;
  }, []);

  const stopPreviewPitch = useCallback(() => {
    if (sustainedNoteStopRef.current) { sustainedNoteStopRef.current(); sustainedNoteStopRef.current = null; }
  }, []);

  const previewDrum = useCallback((pitch: number) => { resumeAudio(); playDrum(pitch, 100); }, []);

  const muteTrack = useCallback((trackId: string) => {
    setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
      tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t)
    ));
  }, []);

  const toggleCollapse = useCallback((trackId: string) => {
    setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
      tracks.map(t => t.id === trackId ? { ...t, collapsed: !t.collapsed } : t)
    ));
  }, []);

  const deleteTrack = useCallback((trackId: string) => {
    setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
      tracks.filter(t => t.id !== trackId)
    ));
  }, []);

  const updateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
      tracks.map(t => t.id === trackId ? { ...t, ...updates } : t)
    ));
  }, []);

  const addMelodicTrack = useCallback(() => {
    setSong(prev => updateClipInSong(prev, selectedClipIdRef.current, clip => {
      if (clip.tracks.filter(t => !t.isDrum).length >= 10) return clip;
      const idx = clip.tracks.length;
      const newTrack: Track = {
        id: makeNoteId(), name: `Track ${clip.tracks.filter(t => !t.isDrum).length + 1}`,
        color: TRACK_COLORS[idx % TRACK_COLORS.length],
        waveform: 'sine', notes: [], muted: false, isDrum: false,
        volume: 1, attack: 0.01, release: 0.3, collapsed: false, octaveOffset: 0,
      };
      return { ...clip, tracks: [...clip.tracks, newTrack] };
    }));
  }, []);

  const addDrumTrack = useCallback(() => {
    setSong(prev => updateClipInSong(prev, selectedClipIdRef.current, clip => {
      const drumCount   = clip.tracks.filter(t => t.isDrum).length;
      const lastDrumIdx = clip.tracks.reduce((acc, t, i) => t.isDrum ? i : acc, -1);
      const newTrack: Track = {
        id: makeNoteId(), name: `Drums ${drumCount + 1}`,
        color: TRACK_COLORS[(drumCount + 3) % TRACK_COLORS.length],
        waveform: 'sine', notes: [], muted: false, isDrum: true,
        volume: 1, attack: 0.01, release: 0.3, collapsed: false, octaveOffset: 0,
        drumRows: [...DEFAULT_DRUM_ROWS],
      };
      const tracks = [...clip.tracks];
      tracks.splice(lastDrumIdx + 1, 0, newTrack);
      return { ...clip, tracks };
    }));
  }, []);

  const addDrumPiece = useCallback((trackId: string, pitch: number) => {
    setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
      tracks.map(t => {
        if (t.id !== trackId) return t;
        const rows = t.drumRows?.length ? t.drumRows : [...DEFAULT_DRUM_ROWS];
        if (rows.includes(pitch)) return t;
        return { ...t, drumRows: [...rows, pitch] };
      })
    ));
  }, []);

  const removeDrumPiece = useCallback((trackId: string, pitch: number) => {
    setSong(prev => updateTracksInClip(prev, selectedClipIdRef.current, tracks =>
      tracks.map(t => {
        if (t.id !== trackId) return t;
        const rows = (t.drumRows?.length ? t.drumRows : [...DEFAULT_DRUM_ROWS]).filter(p => p !== pitch);
        return { ...t, drumRows: rows, notes: t.notes.filter(n => n.pitch !== pitch) };
      })
    ));
  }, []);

  // ── Song-level callbacks ────────────────────────────────────────────────────

  const addClip = useCallback(() => {
    setSong(prev => {
      if (prev.clips.length >= 8) return prev;
      const letters = 'ABCDEFGH';
      const label   = letters[prev.clips.length] ?? String(prev.clips.length + 1);
      const newClip: Clip = {
        id: makeNoteId(), name: `Pattern ${label}`,
        color: TRACK_COLORS[prev.clips.length % TRACK_COLORS.length],
        bars: 2, tracks: makeDefaultTracks(),
      };
      return { ...prev, clips: [...prev.clips, newClip] };
    });
  }, []);

  const removeClip = useCallback((clipId: string) => {
    setSong(prev => {
      if (prev.clips.length <= 1) return prev;
      return {
        ...prev,
        clips: prev.clips.filter(c => c.id !== clipId),
        arrangement: prev.arrangement.filter(bl => bl.clipId !== clipId),
      };
    });
    setSelectedClipId(prev => prev === clipId ? (song.clips.find(c => c.id !== clipId)?.id ?? '') : prev);
  }, [song.clips]);

  const renameClip = useCallback((clipId: string, name: string) => {
    setSong(prev => updateClipInSong(prev, clipId, c => ({ ...c, name })));
  }, []);

  const recolorClip = useCallback((clipId: string, color: string) => {
    setSong(prev => updateClipInSong(prev, clipId, c => ({ ...c, color })));
  }, []);

  const toggleBlock = useCallback((clipId: string, bar: number) => {
    setSong(prev => {
      const clip = prev.clips.find(c => c.id === clipId);
      if (!clip) return prev;
      // Find block that covers this bar
      const existing = prev.arrangement.find(bl =>
        bl.clipId === clipId && bl.startBar <= bar && bar < bl.startBar + clip.bars
      );
      if (existing) {
        return { ...prev, arrangement: prev.arrangement.filter(bl => bl.id !== existing.id) };
      }
      // Add new block; clamp to arrangement length
      if (bar + clip.bars > prev.arrangementBars) return prev;
      const newBlock: SongBlock = { id: makeNoteId(), clipId, startBar: bar };
      return { ...prev, arrangement: [...prev.arrangement, newBlock] };
    });
  }, []);

  const changeArrangementBars = useCallback((delta: number) => {
    setSong(prev => {
      const next = Math.max(4, prev.arrangementBars + delta);
      const arrangement = delta < 0
        ? prev.arrangement.filter(bl => {
            const clip = prev.clips.find(c => c.id === bl.clipId);
            return bl.startBar + (clip?.bars ?? 1) <= next;
          })
        : prev.arrangement;
      return { ...prev, arrangementBars: next, arrangement };
    });
  }, []);

  const newSong = useCallback(() => {
    stopPlayback();
    const s = createInitialSong();
    setSong(s);
    setSelectedClipId(s.clips[0].id);
  }, [stopPlayback]);

  const newClip = useCallback(() => {
    addClip();
  }, [addClip]);

  // ── Select-tool callbacks ──────────────────────────────────────────────────

  const selectNote = useCallback((noteId: string, addToSelection: boolean) => {
    setSelectedIds(prev => {
      const next = new Set<string>(prev);
      if (addToSelection) { if (next.has(noteId)) next.delete(noteId); else next.add(noteId); }
      else { next.clear(); next.add(noteId); }
      return next;
    });
  }, []);

  const deselectAll = useCallback(() => { setSelectedIds(new Set<string>()); }, []);

  const startMove = useCallback((noteId: string, clientX: number, clientY: number) => {
    setSelectedIds(prev => {
      const next = new Set<string>(prev);
      if (!next.has(noteId)) { next.clear(); next.add(noteId); }
      const notes = new Map<string, MoveNote>();
      const clip = songRef.current.clips.find(c => c.id === selectedClipIdRef.current) ?? songRef.current.clips[0];
      clip?.tracks.forEach(t => {
        t.notes.forEach(n => { if (next.has(n.id)) notes.set(n.id, { trackId: t.id, origPitch: n.pitch, origStep: n.startStep }); });
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
        { label: 'New Song',           onClick: newSong },
        { label: 'New Clip',           onClick: newClip },
        { separator: true },
        { label: 'Save to Library…',   onClick: () => setShowSave(true) },
        { label: 'Load from Library…', onClick: () => setShowLoad(true) },
        { label: 'Download JSON',      onClick: () => downloadJson(songRef.current) },
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
        { label: 'BPM 80',  onClick: () => setSong(s => ({ ...s, bpm: 80  })) },
        { label: 'BPM 120', onClick: () => setSong(s => ({ ...s, bpm: 120 })) },
        { label: 'BPM 160', onClick: () => setSong(s => ({ ...s, bpm: 160 })) },
      ],
    },
  ], [isPlaying, startPlayback, stopPlayback, newSong, newClip, addMelodicTrack, addDrumTrack, onQuit]);

  useWindowMenus(menus);

  // ── Render ─────────────────────────────────────────────────────────────────

  const rulerSteps: { s: number; isBar: boolean; label: string }[] = useMemo(() =>
    Array.from({ length: totalSteps }, (_, s) => {
      const isBar  = s % (song.stepsPerBeat * song.beatsPerBar) === 0;
      const isBeat = !isBar && s % song.stepsPerBeat === 0;
      if (!isBar && !isBeat) return null;
      return { s, isBar, label: isBar ? String(s / (song.stepsPerBeat * song.beatsPerBar) + 1) : '' };
    }).filter((x): x is { s: number; isBar: boolean; label: string } => x !== null),
    [totalSteps, song.stepsPerBeat, song.beatsPerBar],
  );

  const modalTrack = modalTid && selectedClip
    ? selectedClip.tracks.find(t => t.id === modalTid) ?? null
    : null;

  return (
    <div className="me-root">
      <Transport
        song={song}
        selectedClipId={selectedClipId}
        isPlaying={isPlaying}
        zoomIdx={zoomIdx}
        tool={tool}
        view={view}
        onPlay={startPlayback}
        onStop={stopPlayback}
        onBpmChange={bpm => setSong(s => ({ ...s, bpm: Math.max(40, Math.min(240, bpm)) }))}
        onBarsChange={bars => { stopPlayback(); setSong(prev => updateClipInSong(prev, selectedClipId, c => ({ ...c, bars }))); }}
        onStepsPerBeatChange={spb => { stopPlayback(); setSong(s => ({ ...s, stepsPerBeat: spb })); }}
        onZoomIn={() => setZoomIdx(i => Math.min(i + 1, ZOOM_PRESETS.length - 1))}
        onZoomOut={() => setZoomIdx(i => Math.max(i - 1, 0))}
        onNew={() => view === 'pattern' ? newClip() : newSong()}
        onToolChange={setTool}
        onViewChange={v => { stopPlayback(); setView(v); }}
        onSelectClip={id => { setSelectedClipId(id); setView('pattern'); }}
      />

      <div className="me-outer">
        {view === 'song' ? (
          <SongView
            song={song}
            playheadRef={playheadRef}
            onToggleBlock={toggleBlock}
            onEditClip={id => { setSelectedClipId(id); setView('pattern'); }}
            onAddClip={addClip}
            onRemoveClip={removeClip}
            onRenameClip={renameClip}
            onRecolorClip={recolorClip}
            onChangeArrangementBars={changeArrangementBars}
          />
        ) : (
          <div className="me-inner" style={{ minWidth: LEFT_W + gridW }}>
            {/* Ruler */}
            <div className="me-ruler" style={{ height: RULER_H }}>
              <div className="me-ruler-corner" style={{ width: LEFT_W }} />
              <div className="me-ruler-steps" style={{ width: gridW, height: RULER_H }}>
                {rulerSteps.map(({ s, isBar, label }) => (
                  <div key={s} className={`me-ruler-mark${isBar ? ' me-ruler-mark--bar' : ' me-ruler-mark--beat'}`}
                    style={{ left: s * stepW }}>{label}</div>
                ))}
              </div>
            </div>

            {/* Tracks */}
            {(selectedClip?.tracks ?? []).map(track => (
              <TrackSection
                key={track.id}
                track={track}
                totalSteps={totalSteps}
                stepsPerBeat={song.stepsPerBeat}
                beatsPerBar={song.beatsPerBar}
                stepW={stepW}
                rowH={rowH}
                tool={tool}
                selectedIds={selectedIds}
                paintModeRef={paintModeRef}
                lastNoteDurationRef={lastNoteDurationRef}
                onToggleCollapse={() => toggleCollapse(track.id)}
                onGear={() => {
                  modalOrigRef.current = { waveform: track.waveform, volume: track.volume, gmProgram: track.gmProgram, octaveOffset: track.octaveOffset };
                  setModalTid(track.id);
                }}
                onMute={() => muteTrack(track.id)}
                onAddNote={(pitch, step, duration, noteId) => addNote(track.id, pitch, step, duration, noteId)}
                onAddDrumNote={(pitch, step) => addNote(track.id, pitch, step)}
                onRemoveNote={noteId => removeNote(track.id, noteId)}
                onStartResize={(noteId, startX, origDur, noteStart) => startResize(noteId, track.id, startX, origDur, noteStart)}
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
            <div ref={playheadRef} className="me-playhead" style={{ top: RULER_H, display: 'none' }} />
          </div>
        )}
      </div>

      {/* Overlays */}
      {modalTrack && (
        <InstrumentModal
          track={modalTrack}
          canDelete={(selectedClip?.tracks.length ?? 0) > 1}
          onApply={updates => updateTrack(modalTrack.id, updates)}
          onSave={updates => { modalOrigRef.current = null; updateTrack(modalTrack.id, updates); setModalTid(null); }}
          onClose={() => {
            if (modalOrigRef.current) { updateTrack(modalTrack.id, modalOrigRef.current); modalOrigRef.current = null; }
            setModalTid(null);
          }}
          onDelete={() => { modalOrigRef.current = null; deleteTrack(modalTrack.id); setModalTid(null); }}
        />
      )}
      {showSave && (
        <SaveDialog
          onSave={name => { persistSave(name, songRef.current); setShowSave(false); }}
          onClose={() => setShowSave(false)}
        />
      )}
      {showLoad && (
        <LoadDialog
          onLoad={s => { stopPlayback(); setSong(s); setSelectedClipId(s.clips[0]?.id ?? ''); setShowLoad(false); }}
          onClose={() => setShowLoad(false)}
        />
      )}
    </div>
  );
}
