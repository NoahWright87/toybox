import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";
import PinballEditor from "../experiences/PinballEditor/PinballEditor";

export default function PinballEditorPage() {
  return (
    <StandaloneWindow
      title="Noahsoft Board Studio — Pinball Editor"
      icon="🎮"
      fullscreen
      confirmClose="Return to Doors 97? Unsaved changes will be lost."
    >
      <PinballEditor />
    </StandaloneWindow>
  );
}
