import Pinball from "../experiences/Pinball/Pinball";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";
import classicBoard from "../experiences/Pinball/boards/classic.json";
import type { Board } from "../experiences/Pinball/boardTypes";

const board = classicBoard as Board;

export default function PinballPage() {
  return (
    <StandaloneWindow
      title="Pinball"
      icon="🎮"
      helpContent={
        <ul>
          <li><strong>Space</strong> — hold to charge plunger, release to launch</li>
          <li><strong>Z or ←</strong> — left flipper</li>
          <li><strong>/ or →</strong> — right flipper</li>
          <li>Hit bumpers for 100 pts, slingshots for 50, targets for 200</li>
          <li>Clear all targets for a 1000 pt bonus + multiplier</li>
          <li>3 balls — don&apos;t let them drain!</li>
        </ul>
      }
    >
      <Pinball board={board} />
    </StandaloneWindow>
  );
}
