import ShmupEditor from "../experiences/ShmupEditor/ShmupEditor";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

// No `helpContent` here — ShmupEditor.tsx registers its own "Help" menu
// (Tile Editor / Encounter Editor topics) via useWindowMenus, which covers
// both this standalone route and the Doors 97 Window hosting path.
// StandaloneWindow would otherwise append a second "Help" label alongside
// that one.
export default function ShmupEditorPage() {
  return (
    <StandaloneWindow title="Shmup Editor" icon="🧩">
      <ShmupEditor />
    </StandaloneWindow>
  );
}
