# MIDI Editor — TODOs

## Sooner

- [#91](https://github.com/NoahWright87/toybox/issues/91) Change base octave of instruments
  - Let users set the octave for each instrument; "middle C" pitch is relative to this setting
  - Expose as a per-instrument setting in the piano roll or instrument panel

- [#93](https://github.com/NoahWright87/toybox/issues/93) Overhaul editor tools — select, draw, paint
  - **Select tool:** click to select notes, drag to move them, copy/paste support
  - **Draw tool:** click places one note; click-and-drag extends the note length
  - **Paint tool:** sweep across cells to place multiple notes at once
  - New notes default to the same length as the last-placed note (Fruity Loops convention)
  - Piano roll keys (left side): pressing and holding should sustain the note, not just play a short blip
  - Shift-hover over a note: highlight other notes sharing the same scale key as the hovered instrument's key
  - Per-instrument key + octave selection: sets what "middle C" resolves to in pitch

## Later

- [#92](https://github.com/NoahWright87/toybox/issues/92) Sequencer — arrange multiple tracks into a song
  - Currently limited to a few bars of a single track
  - Add a pattern/sequence view so multiple patterns can be chained together in a song arrangement

## Backlog

## Reminders

- Move completed items to a `midi-editor.md` spec — this file is for future plans, not current state
- Items flow: INTAKE → `spec.todo.md` → this file → `midi-editor.md` (when done)
