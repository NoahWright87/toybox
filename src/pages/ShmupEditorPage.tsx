import ShmupEditor from "../experiences/ShmupEditor/ShmupEditor";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function ShmupEditorPage() {
  return (
    <StandaloneWindow
      title="Shmup Editor"
      icon="🧩"
      helpContent={
        <ul>
          <li>Click "+ New Tile" to author a tile's footprint and edges</li>
          <li>North/south edges take one tag per column; east/west are single tags</li>
          <li>Check "Wall" on an edge to mark it hard-wall (nothing may connect there)</li>
          <li>Connector tiles automatically match any south edge</li>
          <li>Use Connection Tester to check whether two tiles actually attach</li>
          <li>Tiles save automatically to TILES.DAT in the virtual filesystem</li>
        </ul>
      }
    >
      <ShmupEditor />
    </StandaloneWindow>
  );
}
