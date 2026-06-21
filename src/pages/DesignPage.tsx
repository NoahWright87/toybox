import { useNavigate } from "react-router-dom";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";
import DesignApp from "../experiences/Design/DesignApp";

// Public design-system surface, served at /design (→ design.doors97.com).
// Wraps the same DesignApp that runs as a window inside NS Doors 97.
export default function DesignPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow
      title="Design"
      icon="🎛️"
      helpContent={
        <ul>
          <li>Pick a component or token group from the left panel.</li>
          <li>Color edits save to C:\System\theme.ini and re-skin the OS live.</li>
          <li>Open theme.ini in Notebook to hand-edit the same values.</li>
        </ul>
      }
    >
      <DesignApp onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
