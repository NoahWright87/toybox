import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useWindowMenus } from '../../components/Window/useWindowMenus';
import type { MenuBarMenu } from '../../components/MenuBar/MenuBar';
import {
  type Pattern,
  type Track,
  type Note,
  type DrumType,
  type OscWaveform,
  DRUM_TYPES,
  DRUM_LABELS,
  DRUM_PITCHES,
  PIANO_MIN,
  PIANO_MAX,
  STEP_W,
  ROW_H,
  isBlackPitch,
  pitchName,
  makeNoteId,
  createInitialPattern,
  TRACK_COLORS,
} from './types';
import { resumeAudio, playNote, playDrum } from './audio';
import './MidiEditor.css';

// ── Module-level constants ─────────────────────────────────────────────────────

const PITCH_RANGE: number[] = [];
for (let p = PIANO_MAX; p >= PIANO_MIN; p--) PITCH_RANGE.push(p);

const PITCH_TO_ROW = new Map<number, number>();
PITCH_RANGE.forEach((p, i) => PITCH_TO_ROW.set(p, i));

const DRUM_SEP_H = 5; // visual separator between melodic rows and drum rows
const MELODIC_H = PITCH_RANGE.length * ROW_H;
const DRUM_H = DRUM_TYPES.length * ROW_H;

// Paint state: section prevents cross-contamination between melodic and drum drag
type PaintState = { action: 'add' | 'remove'; section: 'melodic' | 'drum' } | null;

function buildNoteMap(track: Track): Map<string, string> {
  const m = new Map<string, string>();
  track.notes.forEach(n => {
    for (let d = 0; d < n.durationSteps; d++) {
      m.set(`${n.pitch},${n.startStep + d}`, n.id);
    }
  });
  return m;
}

// ── Transport ──────────────────────────────────────────────────────────────────

interface TransportProps {
  pattern: Pattern;
  isPlaying: boolean;
  activeTrackIdx: number;
  activeTrack: Track;
  melodicTrackCount: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onBarsChange: (bars: number) => void;
  onStepsPerBeatChange: (spb: number) => void;
  onActiveTrackChange: (idx: number) => void;
  onMuteTrack: (trackId: string) => void;
  onChangeWaveform: (trackId: string, waveform: OscWaveform) => void;
  onAddTrack: () => void;
  onRemoveTrack: () => void;
  onNewPattern: () => void;
}

function Transport({
  pattern,
  isPlaying,
  activeTrackIdx,
  activeTrack,
  melodicTrackCount,
  onPlay,
  onStop,
  onBpmChange,
  onBarsChange,
  onStepsPerBeatChange,
  onActiveTrackChange,
  onMuteTrack,
  onChangeWaveform,
  onAddTrack,
  onRemoveTrack,
  onNewPattern,
}: TransportProps) {
  const melodicTracks = pattern.tracks.filter(t => !t.isDrum);

  function nudgeBpm(delta: number) {
    onBpmChange(Math.max(40, Math.min(240, pattern.bpm + delta)));
  }

  return (
    <div className="me-transport">
      <div className="me-transport__row">
        <button
          className={`me-btn me-btn--play ${isPlaying ? 'me-btn--stop' : ''}`}
          onMouseDown={isPlaying ? onStop : onPlay}
        >
          {isPlaying ? '■' : '▶'}
        </button>

        <div className="me-transport__group">
          <span className="me-label">BPM</span>
          <button className="me-btn me-btn--sm" onMouseDown={() => nudgeBpm(-5)}>-</button>
          <input
            className="me-num-input"
            type="number"
            min={40}
            max={240}
            value={pattern.bpm}
            onChange={e => onBpmChange(Number(e.target.value))}
          />
          <button className="me-btn me-btn--sm" onMouseDown={() => nudgeBpm(5)}>+</button>
        </div>

        <div className="me-transport__group">
          <span className="me-label">BARS</span>
          <select className="me-select" value={pattern.bars} onChange={e => onBarsChange(Number(e.target.value))}>
            {[1, 2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
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
        <button className="me-btn me-btn--new" onMouseDown={onNewPattern}>NEW</button>
        <span className="me-label me-label--dim">SPACE=play</span>
      </div>

      <div className="me-transport__row">
        <span className="me-label me-label--dim">ROLL:</span>
        {melodicTracks.map((t, i) => (
          <button
            key={t.id}
            className={`me-track-btn ${i === activeTrackIdx ? 'me-track-btn--active' : ''}`}
            style={{ '--track-color': t.color } as React.CSSProperties}
            onMouseDown={() => onActiveTrackChange(i)}
          >
            {t.name}
          </button>
        ))}
        <button className="me-btn me-btn--sm" onMouseDown={onAddTrack} disabled={melodicTrackCount >= 10} title="Add track">+TRK</button>
        <button className="me-btn me-btn--sm" onMouseDown={onRemoveTrack} disabled={melodicTrackCount <= 1} title="Remove active track">-TRK</button>

        <div className="me-transport__sep" />

        <span className="me-label me-label--dim">WAVE:</span>
        <select
          className="me-select"
          value={activeTrack.waveform}
          onChange={e => onChangeWaveform(activeTrack.id, e.target.value as OscWaveform)}
        >
          <option value="sine">Sine</option>
          <option value="triangle">Tri</option>
          <option value="square">Sqr</option>
          <option value="sawtooth">Saw</option>
        </select>

        <div className="me-transport__sep" />
        <span className="me-label me-label--dim">MUTE:</span>
        {pattern.tracks.map(t => (
          <button
            key={t.id}
            className={`me-mute-btn ${t.muted ? 'me-mute-btn--muted' : ''}`}
            style={{ '--track-color': t.color } as React.CSSProperties}
            onMouseDown={() => onMuteTrack(t.id)}
            title={`${t.muted ? 'Unmute' : 'Mute'} ${t.name}`}
          >
            {t.name[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Unified Piano Roll + Drums grid ───────────────────────────────────────────

interface PianoRollProps {
  melodicTrack: Track;
  drumTrack: Track;
  totalSteps: number;
  stepsPerBeat: number;
  beatsPerBar: number;
  playheadRef: React.RefObject<HTMLDivElement | null>;
  paintModeRef: React.MutableRefObject<PaintState>;
  onAddNote: (trackId: string, pitch: number, step: number) => void;
  onRemoveNote: (trackId: string, noteId: string) => void;
  onStartResize: (noteId: string, startX: number, origDuration: number, noteStartStep: number) => void;
  onPreviewPitch: (pitch: number) => void;
  onPreviewDrum: (pitch: number) => void;
}

function PianoRoll({
  melodicTrack,
  drumTrack,
  totalSteps,
  stepsPerBeat,
  beatsPerBar,
  playheadRef,
  paintModeRef,
  onAddNote,
  onRemoveNote,
  onStartResize,
  onPreviewPitch,
  onPreviewDrum,
}: PianoRollProps) {
  const noteMap     = useMemo(() => buildNoteMap(melodicTrack), [melodicTrack]);
  const drumNoteMap = useMemo(() => buildNoteMap(drumTrack),    [drumTrack]);

  const lastPaintedRef      = useRef('');
  const lastPreviewPitchRef = useRef(-1);

  const gridWidth  = totalSteps * STEP_W;
  const gridHeight = MELODIC_H + DRUM_SEP_H + DRUM_H;

  // ── Melodic cell handlers ──────────────────────────────────────────────────

  function handleCellDown(pitch: number, step: number) {
    paintModeRef.current = { action: 'add', section: 'melodic' };
    lastPaintedRef.current      = `m:${pitch},${step}`;
    lastPreviewPitchRef.current = pitch;
    onAddNote(melodicTrack.id, pitch, step);
    onPreviewPitch(pitch);
  }

  function handleCellEnter(pitch: number, step: number) {
    const pm = paintModeRef.current;
    if (!pm || pm.section !== 'melodic' || pm.action !== 'add') return;
    const key = `m:${pitch},${step}`;
    if (key === lastPaintedRef.current || noteMap.has(`${pitch},${step}`)) return;
    lastPaintedRef.current = key;
    onAddNote(melodicTrack.id, pitch, step);
    if (pitch !== lastPreviewPitchRef.current) {
      lastPreviewPitchRef.current = pitch;
      onPreviewPitch(pitch);
    }
  }

  function handleNoteDown(e: React.MouseEvent, note: Note, noteW: number) {
    e.stopPropagation();
    e.preventDefault();
    if (e.nativeEvent.offsetX >= noteW - 6) {
      paintModeRef.current = null;
      onStartResize(note.id, e.clientX, note.durationSteps, note.startStep);
    } else {
      paintModeRef.current = { action: 'remove', section: 'melodic' };
      lastPaintedRef.current = note.id;
      onRemoveNote(melodicTrack.id, note.id);
    }
  }

  function handleNoteEnter(note: Note) {
    const pm = paintModeRef.current;
    if (!pm || pm.section !== 'melodic' || pm.action !== 'remove') return;
    if (note.id === lastPaintedRef.current) return;
    lastPaintedRef.current = note.id;
    onRemoveNote(melodicTrack.id, note.id);
  }

  // ── Drum cell handlers ─────────────────────────────────────────────────────

  function handleDrumDown(pitch: number, step: number, existingId: string | undefined) {
    if (existingId) {
      paintModeRef.current = { action: 'remove', section: 'drum' };
      lastPaintedRef.current = existingId;
      onRemoveNote(drumTrack.id, existingId);
    } else {
      paintModeRef.current = { action: 'add', section: 'drum' };
      lastPaintedRef.current = `d:${pitch},${step}`;
      onAddNote(drumTrack.id, pitch, step);
      onPreviewDrum(pitch);
    }
  }

  function handleDrumEnter(pitch: number, step: number, existingId: string | undefined) {
    const pm = paintModeRef.current;
    if (!pm || pm.section !== 'drum') return;
    if (pm.action === 'add') {
      const key = `d:${pitch},${step}`;
      if (key === lastPaintedRef.current || existingId) return;
      lastPaintedRef.current = key;
      onAddNote(drumTrack.id, pitch, step);
      onPreviewDrum(pitch);
    } else {
      if (!existingId || existingId === lastPaintedRef.current) return;
      lastPaintedRef.current = existingId;
      onRemoveNote(drumTrack.id, existingId);
    }
  }

  const noteRects = useMemo(
    () => melodicTrack.notes.filter(n => n.startStep < totalSteps),
    [melodicTrack.notes, totalSteps],
  );

  return (
    <div className="me-piano-roll">
      {/* ── Left sidebar: piano keys + drum labels ─────────────────────── */}
      <div className="me-piano-keys" style={{ height: gridHeight }}>
        {/* Melodic piano keys */}
        {PITCH_RANGE.map(pitch => {
          const isBlack = isBlackPitch(pitch);
          const isC = pitch % 12 === 0;
          return (
            <div
              key={pitch}
              className={`me-key ${isBlack ? 'me-key--black' : 'me-key--white'}`}
              style={{ height: ROW_H }}
              onMouseDown={() => { onPreviewPitch(pitch); lastPreviewPitchRef.current = pitch; }}
              onMouseEnter={e => { if (e.buttons === 1) { onPreviewPitch(pitch); lastPreviewPitchRef.current = pitch; } }}
            >
              {isC && <span className="me-key__label">{pitchName(pitch)}</span>}
            </div>
          );
        })}

        {/* Separator */}
        <div className="me-drum-key-sep" style={{ height: DRUM_SEP_H }} />

        {/* Drum row labels */}
        {DRUM_TYPES.map((dt: DrumType) => (
          <div
            key={dt}
            className="me-drum-key"
            style={{ height: ROW_H }}
            onMouseDown={() => onPreviewDrum(DRUM_PITCHES[dt])}
            onMouseEnter={e => { if (e.buttons === 1) onPreviewDrum(DRUM_PITCHES[dt]); }}
          >
            {DRUM_LABELS[dt]}
          </div>
        ))}
      </div>

      {/* ── Note grid ─────────────────────────────────────────────────────── */}
      <div className="me-note-grid-wrap">
        <div className="me-note-grid" style={{ width: gridWidth, height: gridHeight }}>

          {/* Step column markers */}
          {Array.from({ length: totalSteps }, (_, s) => s).map(step => {
            const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
            const isBeat = !isBar && step % stepsPerBeat === 0;
            const isQ4   = !isBar && !isBeat && step % 4 === 0;
            return (
              <div
                key={`col-${step}`}
                className={`me-step-col${isBar ? ' me-step-col--bar' : isBeat ? ' me-step-col--beat' : isQ4 ? ' me-step-col--q4' : ''}`}
                style={{ left: step * STEP_W, width: STEP_W, height: gridHeight }}
              />
            );
          })}

          {/* Melodic background cells (empty spots only) */}
          {PITCH_RANGE.map((pitch, rowIdx) => {
            const isBlack = isBlackPitch(pitch);
            return Array.from({ length: totalSteps }, (_, step) => {
              if (noteMap.has(`${pitch},${step}`)) return null;
              return (
                <div
                  key={`bg-${pitch}-${step}`}
                  className={`me-cell ${isBlack ? 'me-cell--black' : 'me-cell--white'}`}
                  style={{ left: step * STEP_W, top: rowIdx * ROW_H, width: STEP_W, height: ROW_H }}
                  onMouseDown={e => { e.preventDefault(); handleCellDown(pitch, step); }}
                  onMouseEnter={() => handleCellEnter(pitch, step)}
                />
              );
            });
          })}

          {/* Melodic note rectangles */}
          {noteRects.map(note => {
            const rowIdx = PITCH_TO_ROW.get(note.pitch);
            if (rowIdx === undefined) return null;
            const displayDur = Math.min(note.durationSteps, totalSteps - note.startStep);
            const noteW = displayDur * STEP_W;
            return (
              <div
                key={note.id}
                className="me-note-rect"
                style={{
                  left: note.startStep * STEP_W,
                  top: rowIdx * ROW_H,
                  width: noteW,
                  height: ROW_H,
                  background: melodicTrack.color,
                }}
                onMouseDown={e => handleNoteDown(e, note, noteW)}
                onMouseEnter={() => handleNoteEnter(note)}
              >
                <div
                  className="me-note-resize-handle"
                  onMouseDown={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    paintModeRef.current = null;
                    onStartResize(note.id, e.clientX, note.durationSteps, note.startStep);
                  }}
                />
              </div>
            );
          })}

          {/* Octave dividers */}
          {PITCH_RANGE.map((pitch, rowIdx) =>
            pitch % 12 === 0 ? (
              <div key={`od-${pitch}`} className="me-row-divider" style={{ top: rowIdx * ROW_H, width: gridWidth }} />
            ) : null
          )}

          {/* Drum section separator */}
          <div
            className="me-drum-section-sep"
            style={{ top: MELODIC_H, width: gridWidth, height: DRUM_SEP_H }}
          />

          {/* Drum cells */}
          {DRUM_TYPES.map((dt: DrumType, drumRowIdx) => {
            const pitch  = DRUM_PITCHES[dt];
            const rowTop = MELODIC_H + DRUM_SEP_H + drumRowIdx * ROW_H;
            return Array.from({ length: totalSteps }, (_, step) => {
              const cellKey    = `${pitch},${step}`;
              const existingId = drumNoteMap.get(cellKey);
              const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
              const isBeat = !isBar && step % stepsPerBeat === 0;
              return (
                <div
                  key={`drum-${dt}-${step}`}
                  className={`me-drum-cell${existingId ? ' me-drum-cell--on' : ''}${isBar ? ' me-drum-cell--bar' : isBeat ? ' me-drum-cell--beat' : ''}`}
                  style={{
                    left: step * STEP_W,
                    top: rowTop,
                    width: STEP_W,
                    height: ROW_H,
                    ...((existingId ? { '--drum-color': drumTrack.color } : {}) as React.CSSProperties),
                  }}
                  onMouseDown={e => { e.preventDefault(); handleDrumDown(pitch, step, existingId); }}
                  onMouseEnter={() => handleDrumEnter(pitch, step, existingId)}
                />
              );
            });
          })}

          {/* Playhead — spans full height including drum rows */}
          <div
            className="me-playhead"
            ref={playheadRef as React.RefObject<HTMLDivElement>}
            style={{ height: gridHeight, display: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface MidiEditorProps {
  onQuit?: () => void;
}

export default function MidiEditor({ onQuit }: MidiEditorProps) {
  const [pattern, setPattern] = useState<Pattern>(createInitialPattern);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);

  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  const isPlayingRef = useRef(false);
  const stepRef      = useRef(0);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playheadRef  = useRef<HTMLDivElement | null>(null);

  const paintModeRef  = useRef(null) as React.MutableRefObject<PaintState>;
  const resizeModeRef = useRef(false);
  const resizeStateRef = useRef<{
    noteId: string; trackId: string;
    startX: number; origDuration: number; noteStartStep: number;
  } | null>(null);

  const activeTrackRef = useRef<Track | null>(null);

  const melodicTracks = useMemo(() => pattern.tracks.filter(t => !t.isDrum), [pattern.tracks]);
  const drumTrack     = useMemo(() => pattern.tracks.find(t => t.isDrum)!,  [pattern.tracks]);

  const clampedIdx = Math.min(activeTrackIdx, melodicTracks.length - 1);
  const activeTrack = melodicTracks[clampedIdx] ?? melodicTracks[0];
  activeTrackRef.current = activeTrack;

  const totalSteps = useMemo(
    () => pattern.bars * pattern.beatsPerBar * pattern.stepsPerBeat,
    [pattern.bars, pattern.beatsPerBar, pattern.stepsPerBeat],
  );

  // ── Playback ─────────────────────────────────────────────────────────────────

  function movePlayhead(step: number) {
    if (playheadRef.current) {
      playheadRef.current.style.display = 'block';
      playheadRef.current.style.transform = `translateX(${step * STEP_W}px)`;
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

    const stepDurSec = 60 / pat.bpm / pat.stepsPerBeat;
    pat.tracks.forEach(track => {
      if (track.muted) return;
      track.notes.forEach((note: Note) => {
        if (note.startStep !== step || note.startStep >= total) return;
        const dur = note.durationSteps * stepDurSec * 0.85;
        if (track.isDrum) playDrum(note.pitch, note.velocity);
        else playNote(note.pitch, note.velocity, dur, track.waveform);
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

  // ── Global mouse events ───────────────────────────────────────────────────────

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!resizeModeRef.current || !resizeStateRef.current) return;
      const { noteId, trackId, startX, origDuration, noteStartStep } = resizeStateRef.current;
      const pat = patternRef.current;
      const maxDur = pat.bars * pat.beatsPerBar * pat.stepsPerBeat - noteStartStep;
      const newDur = Math.max(1, Math.min(maxDur, origDuration + Math.round((e.clientX - startX) / STEP_W)));
      setPattern(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => t.id !== trackId ? t : {
          ...t, notes: t.notes.map(n => n.id !== noteId ? n : { ...n, durationSteps: newDur }),
        }),
      }));
    }

    function handleMouseUp() {
      paintModeRef.current  = null;
      resizeModeRef.current = false;
      resizeStateRef.current = null;
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ── Spacebar ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (isPlayingRef.current) stopPlayback(); else startPlayback();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [startPlayback, stopPlayback]);

  // ── Note editing ──────────────────────────────────────────────────────────────

  const addNote = useCallback((trackId: string, pitch: number, step: number) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        if (t.notes.some(n => n.startStep === step && n.pitch === pitch)) return t;
        const newNote: Note = { id: makeNoteId(), pitch, startStep: step, durationSteps: 1, velocity: 100 };
        return { ...t, notes: [...t.notes, newNote] };
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

  const startResizeNote = useCallback((noteId: string, startX: number, origDuration: number, noteStartStep: number) => {
    resizeModeRef.current = true;
    resizeStateRef.current = {
      noteId,
      trackId: activeTrackRef.current?.id ?? '',
      startX, origDuration, noteStartStep,
    };
  }, []);

  // ── Track management ──────────────────────────────────────────────────────────

  const muteTrack = useCallback((trackId: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t),
    }));
  }, []);

  const changeWaveform = useCallback((trackId: string, waveform: OscWaveform) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, waveform } : t),
    }));
  }, []);

  const addTrack = useCallback(() => {
    setPattern(prev => {
      const melodic = prev.tracks.filter(t => !t.isDrum);
      if (melodic.length >= 10) return prev;
      const idx = melodic.length;
      const newTrack: Track = {
        id: `t${makeNoteId()}`,
        name: `Trk ${idx + 1}`,
        color: TRACK_COLORS[idx % TRACK_COLORS.length],
        waveform: 'sine',
        notes: [], muted: false, isDrum: false,
      };
      return {
        ...prev,
        tracks: [...prev.tracks.filter(t => !t.isDrum), newTrack, ...prev.tracks.filter(t => t.isDrum)],
      };
    });
  }, []);

  const removeActiveTrack = useCallback(() => {
    setPattern(prev => {
      const melodic = prev.tracks.filter(t => !t.isDrum);
      if (melodic.length <= 1) return prev;
      const toRemove = melodic[Math.min(activeTrackIdx, melodic.length - 1)];
      return { ...prev, tracks: prev.tracks.filter(t => t.id !== toRemove.id) };
    });
    setActiveTrackIdx(prev => Math.max(0, prev - 1));
  }, [activeTrackIdx]);

  const newPattern = useCallback(() => {
    stopPlayback();
    setPattern(createInitialPattern());
    setActiveTrackIdx(0);
  }, [stopPlayback]);

  const previewPitch = useCallback((pitch: number) => {
    resumeAudio();
    playNote(pitch, 100, 0.35, activeTrackRef.current?.waveform ?? 'sine');
  }, []);

  const previewDrum = useCallback((pitch: number) => {
    resumeAudio();
    playDrum(pitch, 100);
  }, []);

  // ── Window menus ──────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: 'File',
      items: [
        { label: 'New Pattern', onClick: newPattern },
        ...(onQuit ? [{ separator: true as const }, { label: 'Close', onClick: onQuit }] : []),
      ],
    },
    {
      label: 'Playback',
      items: [
        { label: isPlaying ? 'Stop  ■' : 'Play  ▶', onClick: isPlaying ? stopPlayback : startPlayback },
        { separator: true },
        { label: 'BPM 80',  onClick: () => setPattern(p => ({ ...p, bpm: 80  })) },
        { label: 'BPM 120', onClick: () => setPattern(p => ({ ...p, bpm: 120 })) },
        { label: 'BPM 160', onClick: () => setPattern(p => ({ ...p, bpm: 160 })) },
      ],
    },
    {
      label: 'Track',
      items: melodicTracks.map((t, i) => ({
        label: t.name,
        checked: i === clampedIdx,
        onClick: () => setActiveTrackIdx(i),
      })),
    },
  ], [isPlaying, startPlayback, stopPlayback, newPattern, onQuit, melodicTracks, clampedIdx]);

  useWindowMenus(menus);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="me-root">
      <Transport
        pattern={pattern}
        isPlaying={isPlaying}
        activeTrackIdx={clampedIdx}
        activeTrack={activeTrack}
        melodicTrackCount={melodicTracks.length}
        onPlay={startPlayback}
        onStop={stopPlayback}
        onBpmChange={bpm => setPattern(p => ({ ...p, bpm: Math.max(40, Math.min(240, bpm)) }))}
        onBarsChange={bars => { stopPlayback(); setPattern(p => ({ ...p, bars })); }}
        onStepsPerBeatChange={spb => { stopPlayback(); setPattern(p => ({ ...p, stepsPerBeat: spb })); }}
        onActiveTrackChange={setActiveTrackIdx}
        onMuteTrack={muteTrack}
        onChangeWaveform={changeWaveform}
        onAddTrack={addTrack}
        onRemoveTrack={removeActiveTrack}
        onNewPattern={newPattern}
      />

      <div className="me-body">
        <div className="me-section-label">PIANO ROLL — {activeTrack.name.toUpperCase()}</div>
        <div className="me-piano-roll-wrap">
          <PianoRoll
            melodicTrack={activeTrack}
            drumTrack={drumTrack}
            totalSteps={totalSteps}
            stepsPerBeat={pattern.stepsPerBeat}
            beatsPerBar={pattern.beatsPerBar}
            playheadRef={playheadRef}
            paintModeRef={paintModeRef}
            onAddNote={addNote}
            onRemoveNote={removeNote}
            onStartResize={startResizeNote}
            onPreviewPitch={previewPitch}
            onPreviewDrum={previewDrum}
          />
        </div>
      </div>
    </div>
  );
}
