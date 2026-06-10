import { useNavigate } from "react-router-dom";
import Jazzball from "../experiences/Jazzball/Jazzball";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function JazzballPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow
      title="Jazzball"
      icon="🟧"
      helpContent={
        <ul>
          <li>Click the board to start building a wall — it grows outward in both directions until it hits the edges</li>
          <li>If a ball hits a wall before it finishes, it shatters and you lose a life</li>
          <li>Clear {"≥"}75% of the board to advance — each level adds another ball</li>
          <li>3 lives total, shared across levels</li>
          <li><strong>Right-click</strong> the board, or tap the ↔️/↕️ button, to switch between horizontal and vertical walls</li>
        </ul>
      }
    >
      <Jazzball onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
