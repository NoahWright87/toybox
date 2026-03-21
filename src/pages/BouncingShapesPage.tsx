import { useNavigate } from "react-router-dom";
import { Button } from "@noahwright/design";
import BouncingShapes from "../experiences/BouncingShapes/BouncingShapes";
import HelpOverlay from "../components/HelpOverlay/HelpOverlay";
import "./BouncingShapesPage.css";

export default function BouncingShapesPage() {
  const navigate = useNavigate();

  return (
    <div className="bouncing-shapes-page">
      <BouncingShapes />

      <div className="bouncing-shapes-page__back">
        <Button variant="ghost" color="#ffffff" onClick={() => navigate("/")}>
          ← Toy Box
        </Button>
      </div>

      <HelpOverlay title="Bouncing Shapes">
        <ul>
          <li>Shapes bounce around the screen</li>
          <li>Corner hits are tracked in the bottom-left</li>
          <li><strong>Press ?</strong> to toggle these instructions</li>
        </ul>
      </HelpOverlay>
    </div>
  );
}
