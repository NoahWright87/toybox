import BombFinder from "../experiences/BombFinder/BombFinder";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function BombFinderPage() {
  return (
    <StandaloneWindow
      title="Bomb Finder"
      icon="💣"
      helpContent={
        <>
          <ul>
            <li><strong>Left-click</strong> to reveal a cell</li>
            <li><strong>Right-click</strong> or <strong>Ctrl+click</strong> to place or remove a flag 🚩</li>
            <li>Your first click is always safe — no bomb within 1 square</li>
            <li>Numbers show how many bombs touch that cell</li>
            <li>Clear all non-bomb cells to win</li>
          </ul>
          <hr />
          <ul>
            <li><strong>Safe Reveal</strong> — left+right click a number whose adjacent flags match it to reveal surrounding cells</li>
            <li>Wrong flags mean Safe Reveal can still hit a bomb!</li>
          </ul>
          <hr />
          <ul>
            <li><strong>Beginner</strong> — 9×9 grid, 10 bombs</li>
            <li><strong>Intermediate</strong> — 16×16 grid, 40 bombs</li>
            <li><strong>Expert</strong> — 30×16 grid, 99 bombs</li>
            <li>Click 🙂 to reset · Use <strong>Tap:</strong> buttons for mobile</li>
          </ul>
        </>
      }
    >
      <BombFinder />
    </StandaloneWindow>
  );
}
