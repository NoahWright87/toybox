export type OscWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export const TRACK_COLORS = [
  '#cc4400', '#5b2d8e', '#228833', '#c89000',
  '#1a5fa8', '#a82080', '#607000', '#005a5a', '#804020', '#3a4080',
] as const;

export interface Note {
  id: string;
  pitch: number;
  startStep: number;
  durationSteps: number;
  velocity: number;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  waveform: OscWaveform;
  notes: Note[];
  muted: boolean;
  isDrum: boolean;
  volume: number;     // 0–1
  attack: number;     // seconds
  release: number;    // seconds
  collapsed: boolean;
  drumRows?: number[]; // ordered MIDI pitches; only meaningful for drum tracks
}

export interface Pattern {
  bpm: number;
  bars: number;
  beatsPerBar: number;
  stepsPerBeat: number;
  tracks: Track[];
}

export const DRUM_PITCHES = {
  kick:      36,
  snare:     38,
  clap:      39,
  'tom-l':   41,
  'hihat-c': 42,
  'hihat-o': 46,
  'tom-m':   47,
  crash:     49,
  'tom-h':   50,
  ride:      51,
} as const;

export type DrumType = keyof typeof DRUM_PITCHES;

export const DRUM_TYPES: DrumType[] = [
  'kick', 'snare', 'clap', 'tom-l', 'hihat-c', 'hihat-o', 'tom-m', 'crash', 'tom-h', 'ride',
];

export const DRUM_LABELS: Record<DrumType, string> = {
  kick:      'Kick',
  snare:     'Snare',
  clap:      'Clap',
  'tom-l':   'Tom L',
  'hihat-c': 'HH Cl',
  'hihat-o': 'HH Op',
  'tom-m':   'Tom M',
  crash:     'Crash',
  'tom-h':   'Tom H',
  ride:      'Ride',
};

const PITCH_LABEL_MAP: Record<number, string> = {};
(Object.keys(DRUM_PITCHES) as DrumType[]).forEach(k => {
  PITCH_LABEL_MAP[DRUM_PITCHES[k]] = DRUM_LABELS[k];
});
export function drumPitchLabel(pitch: number): string {
  return PITCH_LABEL_MAP[pitch] ?? `D${pitch}`;
}

export const DEFAULT_DRUM_ROWS = [36, 38, 42, 46]; // kick, snare, hihat-c, hihat-o

export const PIANO_MIN = 36;  // C2
export const PIANO_MAX = 83;  // B5

let noteCounter = 0;
export function makeNoteId(): string {
  return `n${++noteCounter}`;
}

export function isBlackPitch(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12);
}

export function pitchName(pitch: number): string {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

function makeTrack(partial: Omit<Track, 'volume'|'attack'|'release'|'collapsed'>): Track {
  return { ...partial, volume: 1, attack: 0.01, release: 0.3, collapsed: false };
}

export function createInitialPattern(): Pattern {
  return {
    bpm: 120, bars: 2, beatsPerBar: 4, stepsPerBeat: 4,
    tracks: [
      makeTrack({ id: 'drums', name: 'Drums', color: '#c89000', waveform: 'sine',     notes: [], muted: false, isDrum: true,  drumRows: [...DEFAULT_DRUM_ROWS] }),
      makeTrack({ id: 'lead',  name: 'Lead',  color: '#cc4400', waveform: 'sine',     notes: [], muted: false, isDrum: false }),
      makeTrack({ id: 'pad',   name: 'Pad',   color: '#5b2d8e', waveform: 'triangle', notes: [], muted: false, isDrum: false }),
      makeTrack({ id: 'bass',  name: 'Bass',  color: '#228833', waveform: 'sawtooth', notes: [], muted: false, isDrum: false }),
    ],
  };
}
