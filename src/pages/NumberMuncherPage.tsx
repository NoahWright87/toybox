import { useNavigate } from "react-router-dom";
import { Button } from "@noahwright/design";
import NumberMuncher from "../experiences/NumberMuncher/NumberMuncher";
import HelpOverlay from "../components/HelpOverlay/HelpOverlay";
import "./NumberMuncherPage.css";

export default function NumberMuncherPage() {
  const navigate = useNavigate();

  return (
    <div className="number-muncher-page">
      <NumberMuncher />

      <div className="number-muncher-page__back">
        <Button variant="ghost" color="#ffffff" onClick={() => navigate("/")}>
          ← Toy Box
        </Button>
      </div>

      <HelpOverlay title="Number Muncher">
        <ul>
          <li>
            <strong>Arrow keys</strong> to move
          </li>
          <li>
            <strong>Space / Enter</strong> to eat a number
          </li>
          <li>Eat numbers that match the rule shown at the top</li>
          <li>Wrong eat = lose a life · Eat them all = next rule</li>
          <li>
            <strong>Press ?</strong> to toggle these instructions
          </li>
        </ul>
      </HelpOverlay>
    </div>
  );
}
