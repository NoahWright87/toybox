import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useWindowMenus } from '../../components/Window/useWindowMenus';
import type { MenuBarMenu } from '../../components/MenuBar/MenuBar';
import {
  type Pattern,
  type Track,
  type Note,
  type DrumType,
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
} from './types';
import { resumeAudio, playNote, playDrum } from './audio';
import './MidiEditor.css';

const PITCH_RANGE: number[] = [];
for (let p = PIANO_MAX; p >= PIANO_MIN; p--) PITCH_RANGE.push(p);

function buildNoteSet(track: Track): Set<string> {
  const s = new Set<string>();
  track.notes.forEach(n => {
    for (let d = 0; d < n.durationSteps; d++) {
      s.add(`${n.pitch},${n.startStep + d}`);
    }
  });
  return s;
}

// ── Transport ──────────────────────────────────────────────────────────────────

interface TransportProps {
  pattern: Pattern;
  isPlaying: boolean;
  activeTrackIdx: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onBarsChange: (bars: number) => void;
  onStepsPerBeatChange: (spb: number) => void;
  onActiveTrackChange: (idx: number) => void;
  onMuteTrack: (trackId: string) => void;
  onNewPattern: () => void;
}

function Transport({
  pattern,
  isPlaying,
  activeTrackIdx,
  onPlay,
  onStop,
  onBpmChange,
  onBarsChange,
  onStepsPerBeatChange,
  onActiveTrackChange,
  onMuteTrack,
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
          <select
            className="me-select"
            value={pattern.bars}
            onChange={e => onBarsChange(Number(e.target.value))}
          >
            {[1, 2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="me-transport__group">
          <span className="me-label">GRID</span>
          <select
            className="me-select"
            value={pattern.stepsPerBeat}
            onChange={e => onStepsPerBeatChange(Number(e.target.value))}
          >
            <option value={2}>1/8</option>
            <option value={4}>1/16</option>
          </select>
        </div>

        <div className="me-transport__sep" />

        <button className="me-btn me-btn--new" onMouseDown={onNewPattern}>NEW</button>
      </div>

      <div className="me-transport__row">
        <span className="me-label me-label--dim">PIANO ROLL:</span>
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
  onToggleNote: (pitch: number, step: number) => void;
  onPreviewPitch: (pitch: number) => void;
}

function PianoRoll({
  track,
  totalSteps,
  stepsPerBeat,
  beatsPerBar,
  playheadRef,
  onToggleNote,
  onPreviewPitch,
}: PianoRollProps) {
  const noteSet = useMemo(() => buildNoteSet(track), [track]);

  const gridWidth = totalSteps * STEP_W;
  const gridHeight = PITCH_RANGE.length * ROW_H;

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
              onMouseDown={() => onPreviewPitch(pitch)}
            >
              {isC && <span className="me-key__label">{pitchName(pitch)}</span>}
            </div>
          );
        })}
      </div>

      {/* Note grid */}
      <div className="me-note-grid-wrap">
        <div
          className="me-note-grid"
          style={{ width: gridWidth, height: gridHeight }}
        >
          {/* Beat / bar dividers */}
          {Array.from({ length: totalSteps }, (_, s) => s).map(step => (
            <div
              key={`div-${step}`}
              className={`me-step-col ${step % (stepsPerBeat * beatsPerBar) === 0 ? 'me-step-col--bar' : step % stepsPerBeat === 0 ? 'me-step-col--beat' : ''}`}
              style={{ left: step * STEP_W, width: STEP_W, height: gridHeight }}
            />
          ))}

          {/* Note cells */}
          {PITCH_RANGE.map((pitch, rowIdx) => {
            const isBlack = isBlackPitch(pitch);
            return Array.from({ length: totalSteps }, (_, step) => {
              const hasNote = noteSet.has(`${pitch},${step}`);
              return (
                <div
                  key={`${pitch}-${step}`}
                  className={`me-cell ${isBlack ? 'me-cell--black' : 'me-cell--white'} ${hasNote ? 'me-cell--note' : ''}`}
                  style={{
                    left: step * STEP_W,
                    top: rowIdx * ROW_H,
                    width: STEP_W,
                    height: ROW_H,
                    ...(hasNote ? { background: track.color } : {}),
                  }}
                  onMouseDown={() => onToggleNote(pitch, step)}
                />
              );
            });
          })}

          {/* Horizontal dividers (pitch rows) */}
          {PITCH_RANGE.map((pitch, rowIdx) =>
            pitch % 12 === 0 ? (
              <div
                key={`row-div-${pitch}`}
                className="me-row-divider"
                style={{ top: rowIdx * ROW_H, width: gridWidth }}
              />
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
  onToggleNote: (pitch: number, step: number) => void;
}

function StepSeq({
  track,
  totalSteps,
  stepsPerBeat,
  beatsPerBar,
  seqPlayheadRef,
  onToggleNote,
}: StepSeqProps) {
  const drumNoteSet = useMemo(() => buildNoteSet(track), [track]);

  const gridWidth = totalSteps * SEQ_BTN_W;
  const gridHeight = DRUM_TYPES.length * SEQ_BTN_H;

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
            {Array.from({ length: totalSteps }, (_, s) => s).map(step => (
              <div
                key={step}
                className={`me-seq-step-num ${step % (stepsPerBeat * beatsPerBar) === 0 ? 'me-seq-step-num--bar' : step % stepsPerBeat === 0 ? 'me-seq-step-num--beat' : ''}`}
                style={{ width: SEQ_BTN_W }}
              />
            ))}
          </div>

          {/* Button rows */}
          {DRUM_TYPES.map((dt: DrumType, rowIdx) => {
            const pitch = DRUM_PITCHES[dt];
            return (
              <div key={dt} className="me-seq-row" style={{ height: SEQ_BTN_H }}>
                {Array.from({ length: totalSteps }, (_, step) => {
                  const isOn = drumNoteSet.has(`${pitch},${step}`);
                  const isBeat = step % stepsPerBeat === 0;
                  const isBar = step % (stepsPerBeat * beatsPerBar) === 0;
                  return (
                    <button
                      key={step}
                      className={`me-seq-btn ${isOn ? 'me-seq-btn--on' : 'me-seq-btn--off'} ${isBeat ? 'me-seq-btn--beat' : ''} ${isBar ? 'me-seq-btn--bar' : ''}`}
                      style={{ width: SEQ_BTN_W, height: SEQ_BTN_H, ...(isOn ? { background: track.color } : {}) }}
                      onMouseDown={() => onToggleNote(pitch, step)}
                      data-row={rowIdx}
                      data-step={step}
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

  const melodicTracks = useMemo(
    () => pattern.tracks.filter(t => !t.isDrum),
    [pattern.tracks],
  );
  const drumTrack = useMemo(
    () => pattern.tracks.find(t => t.isDrum)!,
    [pattern.tracks],
  );
  const activeTrack = melodicTracks[activeTrackIdx] ?? melodicTracks[0];

  const totalSteps = useMemo(
    () => pattern.bars * pattern.beatsPerBar * pattern.stepsPerBeat,
    [pattern.bars, pattern.beatsPerBar, pattern.stepsPerBeat],
  );

  // Move playhead refs — called from timer, no React state change
  function movePlayhead(step: number) {
    const x = step * STEP_W;
    if (playheadRef.current) {
      playheadRef.current.style.display = 'block';
      playheadRef.current.style.transform = `translateX(${x}px)`;
    }
    const sx = step * SEQ_BTN_W;
    if (seqPlayheadRef.current) {
      seqPlayheadRef.current.style.display = 'block';
      seqPlayheadRef.current.style.transform = `translateX(${sx}px)`;
    }
  }

  function hidePlayhead() {
    if (playheadRef.current) playheadRef.current.style.display = 'none';
    if (seqPlayheadRef.current) seqPlayheadRef.current.style.display = 'none';
  }

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
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
        if (note.startStep !== step) return;
        if (note.startStep >= total) return;
        const dur = note.durationSteps * stepDurSec * 0.85;
        if (track.isDrum) {
          playDrum(note.pitch, note.velocity);
        } else {
          playNote(note.pitch, note.velocity, dur, track.waveform);
        }
      });
    });

    stepRef.current = (step + 1) % total;
    const ms = (60_000 / pat.bpm) / pat.stepsPerBeat;
    timerRef.current = setTimeout(tick, ms);
  }, []);

  const startPlayback = useCallback(() => {
    resumeAudio();
    isPlayingRef.current = true;
    stepRef.current = 0;
    setIsPlaying(true);
    const ms = (60_000 / patternRef.current.bpm) / patternRef.current.stepsPerBeat;
    timerRef.current = setTimeout(tick, ms);
  }, [tick]);

  // Clean up on unmount
  useEffect(() => () => { stopPlayback(); }, [stopPlayback]);

  const toggleNote = useCallback((trackId: string, pitch: number, step: number) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => {
        if (track.id !== trackId) return track;
        const existing = track.notes.find(n => n.startStep === step && n.pitch === pitch);
        if (existing) {
          return { ...track, notes: track.notes.filter(n => n.id !== existing.id) };
        }
        const newNote: Note = {
          id: makeNoteId(),
          pitch,
          startStep: step,
          durationSteps: 1,
          velocity: 100,
        };
        return { ...track, notes: [...track.notes, newNote] };
      }),
    }));
  }, []);

  const muteTrack = useCallback((trackId: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    }));
  }, []);

  const newPattern = useCallback(() => {
    stopPlayback();
    setPattern(createInitialPattern());
    setActiveTrackIdx(0);
  }, [stopPlayback]);

  const previewPitch = useCallback((pitch: number) => {
    resumeAudio();
    playNote(pitch, 100, 0.4, activeTrack.waveform);
  }, [activeTrack]);

  // ── Window menus ─────────────────────────────────────────────────────────────

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
        checked: i === activeTrackIdx,
        onClick: () => setActiveTrackIdx(i),
      })),
    },
  ], [isPlaying, startPlayback, stopPlayback, newPattern, onQuit, melodicTracks, activeTrackIdx]);

  useWindowMenus(menus);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="me-root">
      <Transport
        pattern={pattern}
        isPlaying={isPlaying}
        activeTrackIdx={activeTrackIdx}
        onPlay={startPlayback}
        onStop={stopPlayback}
        onBpmChange={bpm => setPattern(p => ({ ...p, bpm: Math.max(40, Math.min(240, bpm)) }))}
        onBarsChange={bars => { stopPlayback(); setPattern(p => ({ ...p, bars })); }}
        onStepsPerBeatChange={stepsPerBeat => { stopPlayback(); setPattern(p => ({ ...p, stepsPerBeat })); }}
        onActiveTrackChange={setActiveTrackIdx}
        onMuteTrack={muteTrack}
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
              onToggleNote={(pitch, step) => toggleNote(activeTrack.id, pitch, step)}
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
            onToggleNote={(pitch, step) => toggleNote(drumTrack.id, pitch, step)}
          />
        </div>
      </div>
    </div>
  );
}
