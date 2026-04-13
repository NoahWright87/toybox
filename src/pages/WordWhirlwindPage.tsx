import { useNavigate } from "react-router-dom";
import WordWhirlwind from "../experiences/WordWhirlwind/WordWhirlwind";
import HelpOverlay from "../components/HelpOverlay/HelpOverlay";
import "./WordWhirlwindPage.css";

export default function WordWhirlwindPage() {
  const navigate = useNavigate();

  return (
    <div className="word-whirlwind-page">
      <WordWhirlwind onHome={() => navigate("/")} />

      <HelpOverlay title="Word Whirlwind">
        <ul>
          <li>A scrambled set of letters hides a secret word — find as many sub-words as you can</li>
          <li><strong>Click</strong> a pool letter to place it on the board</li>
          <li><strong>Click</strong> a board letter to return it to the pool</li>
          <li>Type letters directly — matching tiles move to the board automatically</li>
        </ul>
        <hr />
        <ul>
          <li><strong>Enter</strong> — submit your word</li>
          <li><strong>Space</strong> — scramble the pool letters</li>
          <li><strong>Backspace</strong> — remove the last board letter</li>
          <li><strong>Esc</strong> — clear the whole board</li>
        </ul>
        <hr />
        <ul>
          <li><strong>Freeplay</strong> — always advance; just find what you can</li>
          <li><strong>Standard</strong> — find at least one full-length word to advance; full clear earns a big bonus</li>
          <li><strong>Strict</strong> — find <em>every</em> word to advance (good luck)</li>
        </ul>
        <hr />
        <ul>
          <li>Longer words score more points</li>
          <li>Finishing a round early earns a speed bonus</li>
        </ul>
      </HelpOverlay>
    </div>
  );
}
