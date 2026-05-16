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
}

export interface Pattern {
  bpm: number;
  bars: number;
  beatsPerBar: number;
  stepsPerBeat: number;
  tracks: Track[];
}

export const DRUM_PITCHES = {
  kick:     36,
  snare:    38,
  'hihat-c': 42,
  'hihat-o': 46,
} as const;

export type DrumType = keyof typeof DRUM_PITCHES;
export const DRUM_TYPES: DrumType[] = ['kick', 'snare', 'hihat-c', 'hihat-o'];
export const DRUM_LABELS: Record<DrumType, string> = {
  kick:      'Kick',
  snare:     'Snare',
  'hihat-c': 'HiHat C',
  'hihat-o': 'HiHat O',
};

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
      makeTrack({ id: 'drums', name: 'Drums', color: '#c89000', waveform: 'sine',     notes: [], muted: false, isDrum: true  }),
      makeTrack({ id: 'lead',  name: 'Lead',  color: '#cc4400', waveform: 'sine',     notes: [], muted: false, isDrum: false }),
      makeTrack({ id: 'pad',   name: 'Pad',   color: '#5b2d8e', waveform: 'triangle', notes: [], muted: false, isDrum: false }),
      makeTrack({ id: 'bass',  name: 'Bass',  color: '#228833', waveform: 'sawtooth', notes: [], muted: false, isDrum: false }),
    ],
  };
}
