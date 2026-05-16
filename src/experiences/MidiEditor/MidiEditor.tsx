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
  SEQ_BTN_W,
  SEQ_BTN_H,
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

// Maps `${pitch},${step}` → noteId (including all cells spanned by the note)
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
        <button
          className="me-btn me-btn--sm"
          onMouseDown={onAddTrack}
          disabled={melodicTrackCount >= 10}
          title="Add melodic track"
        >+TRK</button>
        <button
          className="me-btn me-btn--sm"
          onMouseDown={onRemoveTrack}
          disabled={melodicTrackCount <= 1}
          title="Remove active track"
        >-TRK</button>

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

// ── Piano Roll ─────────────────────────────────────────────────────────────────

interface PianoRollProps {
  track: Track;
  totalSteps: number;
  stepsPerBeat: number;
  beatsPerBar: number;
  playheadRef: React.RefObject<HTMLDivElement | null>;
  paintModeRef: React.MutableRefObject<'add' | 'remove' | null>;
  onAddNote: (pitch: number, step: number) => void;
  onRemoveNote: (noteId: string) => void;
  onStartResize: (noteId: string, startX: number, origDuration: number, noteStartStep: number) => void;
  onPreviewPitch: (pitch: number) => void;
}

function PianoRoll({
  track,
  totalSteps,
  stepsPerBeat,
  beatsPerBar,
  playheadRef,
  paintModeRef,
  onAddNote,
  onRemoveNote,
  onStartResize,
  onPreviewPitch,
}: PianoRollProps) {
  const noteMap = useMemo(() => buildNoteMap(track), [track]);
  const lastPaintedRef = useRef('');
  const lastPreviewPitchRef = useRef(-1);

  const gridWidth = totalSteps * STEP_W;
  const gridHeight = PITCH_RANGE.length * ROW_H;

  function handleCellDown(pitch: number, step: number) {
    paintModeRef.current = 'add';
    lastPaintedRef.current = `${pitch},${step}`;
    lastPreviewPitchRef.current = pitch;
    onAddNote(pitch, step);
    onPreviewPitch(pitch);
  }

  function handleCellEnter(pitch: number, step: number) {
    if (paintModeRef.current !== 'add') return;
    const key = `${pitch},${step}`;
    if (key === lastPaintedRef.current) return;
    lastPaintedRef.current = key;
    onAddNote(pitch, step);
    if (pitch !== lastPreviewPitchRef.current) {
      lastPreviewPitchRef.current = pitch;
      onPreviewPitch(pitch);
    }
  }

  function handleNoteDown(e: React.MouseEvent, note: Note, noteW: number) {
    e.stopPropagation();
    e.preventDefault();
    const localX = e.nativeEvent.offsetX;
    if (localX >= noteW - 6) {
      // Resize handle
      paintModeRef.current = null;
      onStartResize(note.id, e.clientX, note.durationSteps, note.startStep);
    } else {
      paintModeRef.current = 'remove';
      lastPaintedRef.current = note.id;
      onRemoveNote(note.id);
    }
  }

  function handleNoteEnter(note: Note) {
    if (paintModeRef.current !== 'remove') return;
    if (note.id === lastPaintedRef.current) return;
    lastPaintedRef.current = note.id;
    onRemoveNote(note.id);
  }

  const noteRects = useMemo(() =>
    track.notes.filter(n => n.startStep < totalSteps),
    [track.notes, totalSteps],
  );

  return (
    <div className="me-piano-roll">
      {/* Piano keys column */}
      <div className="me-piano-keys" style={{ height: gridHeight }}>
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
      </div>

      {/* Note grid */}
      <div className="me-note-grid-wrap">
        <div className="me-note-grid" style={{ width: gridWidth, height: gridHeight }}>

          {/* Step column markers (beat / bar lines) */}
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

          {/* Background cells (only where no note occupies) */}
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

          {/* Note rectangles */}
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
                  background: track.color,
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

          {/* Octave dividers (at each C) */}
          {PITCH_RANGE.map((pitch, rowIdx) =>
            pitch % 12 === 0 ? (
              <div key={`od-${pitch}`} className="me-row-divider" style={{ top: rowIdx * ROW_H, width: gridWidth }} />
            ) : null
          )}

          {/* Playhead */}
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

// ── Step Sequencer ─────────────────────────────────────────────────────────────

interface StepSeqProps {
  track: Track;
  totalSteps: number;
  stepsPerBeat: number;
  beatsPerBar: number;
  seqPlayheadRef: React.RefObject<HTMLDivElement | null>;
  seqPaintModeRef: React.MutableRefObject<'add' | 'remove' | null>;
  onAddDrumNote: (pitch: number, step: number) => void;
  onRemoveDrumNote: (noteId: string) => void;
  onPreviewDrum: (pitch: number) => void;
}

function StepSeq({
  track,
  totalSteps,
  stepsPerBeat,
  beatsPerBar,
  seqPlayheadRef,
  seqPaintModeRef,
  onAddDrumNote,
  onRemoveDrumNote,
  onPreviewDrum,
}: StepSeqProps) {
  const drumNoteMap = useMemo(() => buildNoteMap(track), [track]);
  const lastPaintedRef = useRef('');

  const gridWidth = totalSteps * SEQ_BTN_W;
  const gridHeight = DRUM_TYPES.length * SEQ_BTN_H;

  function handleBtnDown(pitch: number, step: number) {
    const key = `${pitch},${step}`;
    const existingId = drumNoteMap.get(key);
    if (existingId) {
      seqPaintModeRef.current = 'remove';
      lastPaintedRef.current = existingId;
      onRemoveDrumNote(existingId);
    } else {
      seqPaintModeRef.current = 'add';
      lastPaintedRef.current = key;
      onAddDrumNote(pitch, step);
      onPreviewDrum(pitch);
    }
  }

  function handleBtnEnter(pitch: number, step: number) {
    const key = `${pitch},${step}`;
    if (seqPaintModeRef.current === 'add') {
      if (key === lastPaintedRef.current || drumNoteMap.has(key)) return;
      lastPaintedRef.current = key;
      onAddDrumNote(pitch, step);
      onPreviewDrum(pitch);
    } else if (seqPaintModeRef.current === 'remove') {
      const existingId = drumNoteMap.get(key);
      if (!existingId || existingId === lastPaintedRef.current) return;
      lastPaintedRef.current = existingId;
      onRemoveDrumNote(existingId);
    }
  }

  return (
    <div className="me-step-seq">
      <div className="me-step-seq__labels">
        <div className="me-step-seq__corner" />
        {DRUM_TYPES.map(dt => (
          <div key={dt} className="me-drum-label" style={{ height: SEQ_BTN_H }}>
            {DRUM_LABELS[dt]}
          </div>
        ))}
      </div>

      <div className="me-step-seq__grid-wrap">
        <div className="me-step-seq__grid" style={{ width: gridWidth, height: gridHeight + SEQ_BTN_H }}>

          {/* Step indicator row */}
          <div className="me-seq-indicator-row" style={{ width: gridWidth }}>
            {Array.from({ length: totalSteps }, (_, s) => s).map(step => {
              const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
              const isBeat = !isBar && step % stepsPerBeat === 0;
              const isQ4   = !isBar && !isBeat && step % 4 === 0;
              return (
                <div
                  key={step}
                  className={`me-seq-step-num${isBar ? ' me-seq-step-num--bar' : isBeat ? ' me-seq-step-num--beat' : isQ4 ? ' me-seq-step-num--q4' : ''}`}
                  style={{ width: SEQ_BTN_W }}
                />
              );
            })}
          </div>

          {/* Button rows */}
          {DRUM_TYPES.map((dt: DrumType) => {
            const pitch = DRUM_PITCHES[dt];
            return (
              <div key={dt} className="me-seq-row" style={{ height: SEQ_BTN_H }}>
                {Array.from({ length: totalSteps }, (_, step) => {
                  const isOn   = drumNoteMap.has(`${pitch},${step}`);
                  const isBar  = step % (stepsPerBeat * beatsPerBar) === 0;
                  const isBeat = !isBar && step % stepsPerBeat === 0;
                  const isQ4   = !isBar && !isBeat && step % 4 === 0;
                  return (
                    <button
                      key={step}
                      className={`me-seq-btn${isOn ? ' me-seq-btn--on' : ' me-seq-btn--off'}${isBar ? ' me-seq-btn--bar' : isBeat ? ' me-seq-btn--beat' : isQ4 ? ' me-seq-btn--q4' : ''}`}
                      style={{ width: SEQ_BTN_W, height: SEQ_BTN_H, ...(isOn ? { background: track.color } : {}) }}
                      onMouseDown={e => { e.preventDefault(); handleBtnDown(pitch, step); }}
                      onMouseEnter={() => handleBtnEnter(pitch, step)}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Playhead overlay */}
          <div
            className="me-seq-playhead"
            ref={seqPlayheadRef as React.RefObject<HTMLDivElement>}
            style={{ height: gridHeight, top: SEQ_BTN_H, display: 'none' }}
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
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const seqPlayheadRef = useRef<HTMLDivElement | null>(null);

  // Paint drag refs (cleared on global mouseup)
  const paintModeRef = useRef(null) as React.MutableRefObject<'add' | 'remove' | null>;
  const seqPaintModeRef = useRef(null) as React.MutableRefObject<'add' | 'remove' | null>;

  // Resize drag refs
  const resizeModeRef = useRef(false);
  const resizeStateRef = useRef<{
    noteId: string; trackId: string;
    startX: number; origDuration: number; noteStartStep: number;
  } | null>(null);

  const activeTrackRef = useRef<Track | null>(null);

  const melodicTracks = useMemo(() => pattern.tracks.filter(t => !t.isDrum), [pattern.tracks]);
  const drumTrack = useMemo(() => pattern.tracks.find(t => t.isDrum)!, [pattern.tracks]);

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
    if (seqPlayheadRef.current) {
      seqPlayheadRef.current.style.display = 'block';
      seqPlayheadRef.current.style.transform = `translateX(${step * SEQ_BTN_W}px)`;
    }
  }

  function hidePlayhead() {
    if (playheadRef.current) playheadRef.current.style.display = 'none';
    if (seqPlayheadRef.current) seqPlayheadRef.current.style.display = 'none';
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
    const pat = patternRef.current;
    const total = pat.bars * pat.beatsPerBar * pat.stepsPerBeat;
    const step = stepRef.current;

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

  // ── Global mouse events (resize + clear paint mode) ───────────────────────────

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!resizeModeRef.current || !resizeStateRef.current) return;
      const { noteId, trackId, startX, origDuration, noteStartStep } = resizeStateRef.current;
      const deltaSteps = Math.round((e.clientX - startX) / STEP_W);
      const pat = patternRef.current;
      const maxDur = pat.bars * pat.beatsPerBar * pat.stepsPerBeat - noteStartStep;
      const newDur = Math.max(1, Math.min(maxDur, origDuration + deltaSteps));
      setPattern(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => t.id !== trackId ? t : {
          ...t,
          notes: t.notes.map(n => n.id !== noteId ? n : { ...n, durationSteps: newDur }),
        }),
      }));
    }

    function handleMouseUp() {
      paintModeRef.current = null;
      seqPaintModeRef.current = null;
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

  // ── Spacebar play/pause ───────────────────────────────────────────────────────

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
      startX,
      origDuration,
      noteStartStep,
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
        notes: [],
        muted: false,
        isDrum: false,
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

  // ── Preview ───────────────────────────────────────────────────────────────────

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
        <div className="me-piano-section">
          <div className="me-section-label">PIANO ROLL — {activeTrack.name.toUpperCase()}</div>
          <div className="me-piano-roll-wrap">
            <PianoRoll
              track={activeTrack}
              totalSteps={totalSteps}
              stepsPerBeat={pattern.stepsPerBeat}
              beatsPerBar={pattern.beatsPerBar}
              playheadRef={playheadRef}
              paintModeRef={paintModeRef}
              onAddNote={(pitch, step) => addNote(activeTrack.id, pitch, step)}
              onRemoveNote={noteId => removeNote(activeTrack.id, noteId)}
              onStartResize={startResizeNote}
              onPreviewPitch={previewPitch}
            />
          </div>
        </div>

        <div className="me-divider" />

        <div className="me-seq-section">
          <div className="me-section-label">STEP SEQUENCER — DRUMS</div>
          <StepSeq
            track={drumTrack}
            totalSteps={totalSteps}
            stepsPerBeat={pattern.stepsPerBeat}
            beatsPerBar={pattern.beatsPerBar}
            seqPlayheadRef={seqPlayheadRef}
            seqPaintModeRef={seqPaintModeRef}
            onAddDrumNote={(pitch, step) => addNote(drumTrack.id, pitch, step)}
            onRemoveDrumNote={noteId => removeNote(drumTrack.id, noteId)}
            onPreviewDrum={previewDrum}
          />
        </div>
      </div>
    </div>
  );
}
