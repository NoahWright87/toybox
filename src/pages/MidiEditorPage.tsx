import MidiEditor from '../experiences/MidiEditor/MidiEditor';
import StandaloneWindow from '../components/StandaloneWindow/StandaloneWindow';

export default function MidiEditorPage() {
  return (
    <StandaloneWindow
      title="MIDI Editor"
      icon="🎹"
      helpContent={
        <ul>
          <li>Click piano roll cells to add/remove notes</li>
          <li>Click piano keys to preview a pitch</li>
          <li>Toggle step sequencer buttons for drums</li>
          <li>Use the transport bar to play/stop</li>
          <li>Select a track to edit in the piano roll</li>
          <li>Mute individual tracks with the M buttons</li>
        </ul>
      }
    >
      <MidiEditor />
    </StandaloneWindow>
  );
}
