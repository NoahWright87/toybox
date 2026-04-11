import { useNavigate } from "react-router-dom";
import { Button } from "@noahwright/design";
import TicTacToe from "../experiences/TicTacToe/TicTacToe";
import HelpOverlay from "../components/HelpOverlay/HelpOverlay";
import "./TicTacToePage.css";

export default function TicTacToePage() {
  const navigate = useNavigate();

  return (
    <div className="tic-tac-toe-page">
      <TicTacToe />

      <div className="tic-tac-toe-page__back">
        <Button variant="ghost" color="#ffffff" onClick={() => navigate("/")}>
          ← Toy Box
        </Button>
      </div>

      <HelpOverlay title="Tic-Tac-Toe">
        <ul>
          <li>Choose a board: <strong>3×3</strong>, <strong>5×5</strong>, or <strong>7×7</strong></li>
          <li>3×3 → 3 in a row · 5×5 → 4 in a row · 7×7 → 5 in a row</li>
          <li>Play against a <strong>friend</strong> or the <strong>computer</strong></li>
          <li>Easy AI picks random squares</li>
          <li>Normal AI will try to win and block you</li>
          <li>Hard AI always picks its best available move</li>
          <li><strong>Click</strong> any empty square to place your mark</li>
          <li><strong>X always goes first</strong></li>
        </ul>
        <hr />
        <ul>
          <li><strong>Debug:</strong> toggle AI weight overlay — shows the score the AI assigns to each empty square for the current player</li>
          <li>Triple-tap the status text <em>(mobile)</em></li>
          <li><strong>Ctrl + .</strong> <em>(keyboard)</em></li>
        </ul>
      </HelpOverlay>
    </div>
  );
}
