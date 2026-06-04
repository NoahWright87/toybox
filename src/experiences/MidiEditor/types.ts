export type OscWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type EditTool = 'select' | 'draw' | 'paint' | 'erase' | 'bend' | 'erase-bend';
export type AppView = 'pattern' | 'song';

// GM instrument names, index = program number 0–127
export const GM_PROGRAMS: string[] = [
  // Piano (0–7)
  'Acoustic Grand Piano','Bright Acoustic Piano','Electric Grand Piano','Honky-tonk Piano',
  'Electric Piano 1','Electric Piano 2','Harpsichord','Clavinet',
  // Chromatic Perc (8–15)
  'Celesta','Glockenspiel','Music Box','Vibraphone','Marimba','Xylophone','Tubular Bells','Dulcimer',
  // Organ (16–23)
  'Drawbar Organ','Percussive Organ','Rock Organ','Church Organ','Reed Organ','Accordion','Harmonica','Tango Accordion',
  // Guitar (24–31)
  'Nylon Guitar','Steel Guitar','Jazz Guitar','Clean Guitar','Muted Guitar','Overdriven Guitar','Distortion Guitar','Guitar Harmonics',
  // Bass (32–39)
  'Acoustic Bass','Finger Bass','Pick Bass','Fretless Bass','Slap Bass 1','Slap Bass 2','Synth Bass 1','Synth Bass 2',
  // Strings (40–47)
  'Violin','Viola','Cello','Contrabass','Tremolo Strings','Pizzicato Strings','Orchestral Harp','Timpani',
  // Ensemble (48–55)
  'String Ensemble 1','String Ensemble 2','Synth Strings 1','Synth Strings 2','Choir Aahs','Voice Oohs','Synth Voice','Orchestra Hit',
  // Brass (56–63)
  'Trumpet','Trombone','Tuba','Muted Trumpet','French Horn','Brass Section','Synth Brass 1','Synth Brass 2',
  // Reed (64–71)
  'Soprano Sax','Alto Sax','Tenor Sax','Baritone Sax','Oboe','English Horn','Bassoon','Clarinet',
  // Pipe (72–79)
  'Piccolo','Flute','Recorder','Pan Flute','Blown Bottle','Shakuhachi','Whistle','Ocarina',
  // Synth Lead (80–87)
  'Lead 1 Square','Lead 2 Sawtooth','Lead 3 Calliope','Lead 4 Chiff','Lead 5 Charang','Lead 6 Voice','Lead 7 Fifths','Lead 8 Bass+Lead',
  // Synth Pad (88–95)
  'Pad 1 New Age','Pad 2 Warm','Pad 3 Polysynth','Pad 4 Choir','Pad 5 Bowed','Pad 6 Metallic','Pad 7 Halo','Pad 8 Sweep',
  // Synth FX (96–103)
  'FX 1 Rain','FX 2 Soundtrack','FX 3 Crystal','FX 4 Atmosphere','FX 5 Brightness','FX 6 Goblins','FX 7 Echoes','FX 8 Sci-fi',
  // Ethnic (104–111)
  'Sitar','Banjo','Shamisen','Koto','Kalimba','Bag Pipe','Fiddle','Shanai',
  // Percussive (112–119)
  'Tinkle Bell','Agogo','Steel Drums','Woodblock','Taiko Drum','Melodic Tom','Synth Drum','Reverse Cymbal',
  // Sound FX (120–127)
  'Fret Noise','Breath Noise','Seashore','Bird Tweet','Telephone Ring','Helicopter','Applause','Gunshot',
];

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

export interface Bend {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  curvature: number; // -1 (9 o'clock/ease-out) to 1 (3 o'clock/ease-in), 0 = linear
}

export interface Track {
  id: string;
  name: string;
  color: string;
  waveform: OscWaveform;
  gmProgram?: number;  // 0–127; undefined = use oscillator synth
  notes: Note[];
  bends: Bend[];
  muted: boolean;
  isDrum: boolean;
  volume: number;     // 0–1
  attack: number;     // seconds
  release: number;    // seconds
  collapsed: boolean;
  drumRows?: number[]; // ordered MIDI pitches; only meaningful for drum tracks
  octaveOffset: number; // semitone shift applied at playback/preview (multiples of 12)
}

// Legacy format kept for migration only — new saves use Song.
export interface Pattern {
  bpm: number;
  bars: number;
  beatsPerBar: number;
  stepsPerBeat: number;
  tracks: Track[];
}

// A Clip is one looping multi-track pattern (the old "Pattern" minus global settings).
export interface Clip {
  id: string;
  name: string;
  color: string;
  bars: number;
  tracks: Track[];
}

export interface SongBlock {
  id: string;
  clipId: string;
  startBar: number; // 0-indexed bar in the arrangement timeline
}

export interface Song {
  bpm: number;
  beatsPerBar: number;
  stepsPerBeat: number;
  clips: Clip[];
  arrangement: SongBlock[];
  arrangementBars: number;
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
export function makeNoteId(): string { return `n${++noteCounter}`; }

let bendCounter = 0;
export function makeBendId(): string { return `b${++bendCounter}`; }

export function isBlackPitch(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12);
}

export function pitchName(pitch: number): string {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

function makeTrack(partial: Omit<Track, 'volume'|'attack'|'release'|'collapsed'|'octaveOffset'|'bends'>): Track {
  return { ...partial, bends: [], volume: 1, attack: 0.01, release: 0.3, collapsed: false, octaveOffset: 0 };
}

export function makeDefaultTracks(): Track[] {
  return [
    makeTrack({ id: 'drums', name: 'Drums', color: '#c89000', waveform: 'sine',     notes: [], muted: false, isDrum: true,  drumRows: [...DEFAULT_DRUM_ROWS] }),
    makeTrack({ id: 'lead',  name: 'Lead',  color: '#cc4400', waveform: 'sine',     notes: [], muted: false, isDrum: false }),
    makeTrack({ id: 'pad',   name: 'Pad',   color: '#5b2d8e', waveform: 'triangle', notes: [], muted: false, isDrum: false }),
    makeTrack({ id: 'bass',  name: 'Bass',  color: '#228833', waveform: 'sawtooth', notes: [], muted: false, isDrum: false }),
  ];
}

export function createInitialSong(): Song {
  const clipId = makeNoteId();
  return {
    bpm: 120, beatsPerBar: 4, stepsPerBeat: 4,
    clips: [{ id: clipId, name: 'Pattern A', color: '#5b2d8e', bars: 2, tracks: makeDefaultTracks() }],
    arrangement: [],
    arrangementBars: 16,
  };
}
