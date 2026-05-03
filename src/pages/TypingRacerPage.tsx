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

      <HelpOverlay title="Type 'Em Up">
        <ul>
          <li>Type the first letter to target the lowest matching word</li>
          <li>Keep typing to shoot it down before it reaches your ship</li>
          <li>Wrong letters make words fall faster</li>
          <li>You have 3 lives — don't let words hit your ship!</li>
          <li><strong>ESC</strong> — return to menu</li>
          <li><strong>Press ?</strong> to toggle these instructions</li>
        </ul>
      </HelpOverlay>
    </div>
  );
}
