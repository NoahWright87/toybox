import JigsawPuzzle from "../experiences/JigsawPuzzle/JigsawPuzzle";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function JigsawPuzzlePage() {
  return (
    <StandaloneWindow
      title="Jigsaw Puzzle"
      icon="🧩"
      helpContent={
        <>
          <ul>
            <li>
              <strong>Drag pieces</strong> with your mouse or finger to move them
              around the workspace
            </li>
            <li>
              Drop a piece near its correct spot in the frame and it will
              <strong> snap into place</strong>
            </li>
            <li>
              <strong>New Puzzle...</strong> (Game menu) returns to the settings
              screen to pick a new image, difficulty, or timer setting
            </li>
            <li>
              Enable <strong>Timed</strong> mode to race the clock and chase a
              best time for each image/difficulty combo
            </li>
            <li>Your progress is saved automatically if you reload the page</li>
          </ul>
        </>
      }
    >
      <JigsawPuzzle />
    </StandaloneWindow>
  );
}
