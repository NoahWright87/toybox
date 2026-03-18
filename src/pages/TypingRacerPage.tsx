import { useNavigate } from "react-router-dom";
import { Button } from "@noahwright/design";
import TypingRacer from "../experiences/TypingRacer/TypingRacer";
import HelpOverlay from "../components/HelpOverlay/HelpOverlay";
import "./TypingRacerPage.css";

export default function TypingRacerPage() {
  const navigate = useNavigate();

  return (
    <div className="typing-racer-page">
      <TypingRacer />

      <div className="typing-racer-page__back">
        <Button variant="ghost" color="#ffffff" onClick={() => navigate("/")}>
          ← Toy Box
        </Button>
      </div>

      <HelpOverlay title="Typing Racer">
        <ul>
          <li>Type the phrase as fast as you can</li>
          <li>Green = correct · Red = wrong</li>
          <li>WPM and accuracy shown on completion</li>
          <li><strong>Press ?</strong> to toggle these instructions</li>
        </ul>
      </HelpOverlay>
    </div>
  );
}
