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
          <li>Choose a difficulty to start — Easy, Normal, and Hard each track their own high score</li>
          <li>Click the board to start building a wall — each side grows outward independently until it hits the edges</li>
          <li>If a ball touches a growing wall (even an already-grown part), that side shatters and you lose a life — the other side keeps growing</li>
          <li>Clear {"≥"}75% of the board to advance — each level adds another ball</li>
          <li><strong>Right-click</strong> the board, or tap the ↔️/↕️ button, to switch between horizontal and vertical walls</li>
          <li>Use the Game menu to start a new game or change difficulty</li>
        </ul>
      }
    >
      <Jazzball onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
