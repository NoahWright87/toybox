import { useNavigate } from "react-router-dom";
import { Button } from "@noahwright/design";
import Starfield from "../experiences/Starfield/Starfield";
import HelpOverlay from "../components/HelpOverlay/HelpOverlay";
import "./StarfieldPage.css";

export default function StarfieldPage() {
  const navigate = useNavigate();

  return (
    <div className="starfield-page">
      <Starfield />

      <div className="starfield-page__back">
        <Button variant="ghost" color="#ffffff" onClick={() => navigate("/")}>
          ← Toy Box
        </Button>
      </div>

      <HelpOverlay title="How to play">
        <ul>
          <li><strong>Click</strong> anywhere to boost</li>
          <li><strong>Scroll</strong> to adjust speed</li>
          <li><strong>Press ?</strong> to toggle these instructions</li>
        </ul>
      </HelpOverlay>
    </div>
  );
}
