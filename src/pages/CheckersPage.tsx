import { useNavigate } from "react-router-dom";
import Checkers from "../experiences/Checkers/Checkers";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function CheckersPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow
      title="Checkers"
      icon="⚫"
      helpContent={
        <>
          <ul>
            <li><strong>Click a piece</strong> to select it</li>
            <li><strong>Click a green square</strong> to move there</li>
            <li>Captures are <strong>mandatory</strong> — if a jump is available you must take it</li>
            <li>Multi-jumps are chained automatically</li>
            <li>Pieces reaching the back rank become <strong>Kings (★)</strong> and can move backwards</li>
          </ul>
          <hr />
          <ul>
            <li>Red always moves first</li>
            <li>Win by capturing all opponent pieces or leaving them with no legal moves</li>
          </ul>
        </>
      }
    >
      <Checkers onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
