import MahjongSolitaire from "../experiences/MahjongSolitaire/MahjongSolitaire";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function MahjongSolitairePage() {
  return (
    <StandaloneWindow
      title="Mahjong Solitaire"
      icon="🀄"
      helpContent={
        <>
          <ul>
            <li>
              <strong>Click a free tile</strong> to select it (it glows orange)
            </li>
            <li>
              <strong>Click a second free tile</strong> with the same face to remove
              both — that&apos;s a match!
            </li>
            <li>
              A tile is <strong>free</strong> when nothing sits on top of it and at
              least one of its left or right sides is open
            </li>
            <li>
              <strong>Hint</strong> highlights a matching pair you can clear right now
            </li>
            <li>
              <strong>New Game</strong> deals a fresh, solvable layout
            </li>
          </ul>
          <hr />
          <ul>
            <li>+10 points per match</li>
            <li>Time bonus on a clear: faster is better</li>
            <li>Goal: clear all 144 tiles!</li>
          </ul>
        </>
      }
    >
      <MahjongSolitaire />
    </StandaloneWindow>
  );
}
