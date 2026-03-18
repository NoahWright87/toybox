import { useNavigate } from "react-router-dom";
import { Button } from "@noahwright/design";
import Fireworks from "../experiences/Fireworks/Fireworks";
import HelpOverlay from "../components/HelpOverlay/HelpOverlay";
import "./FireworksPage.css";

export default function FireworksPage() {
  const navigate = useNavigate();

  return (
    <div className="fireworks-page">
      <Fireworks />

      <div className="fireworks-page__back">
        <Button variant="ghost" color="#ffffff" onClick={() => navigate("/")}>
          ← Toy Box
        </Button>
      </div>

      <HelpOverlay title="Fireworks">
        <ul>
          <li><strong>Click</strong> anywhere to launch a firework</li>
          <li><strong>Tap</strong> on mobile to launch</li>
          <li><strong>Press ?</strong> to toggle these instructions</li>
        </ul>
      </HelpOverlay>
    </div>
  );
}
