import PegSolitaire from "../experiences/PegSolitaire/PegSolitaire";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function PegSolitairePage() {
  return (
    <StandaloneWindow
      title="Peg Solitaire"
      icon="🔴"
      helpContent={
        <>
          <ul>
            <li>
              <strong>Click any peg</strong> to remove it — that&apos;s your starting hole
            </li>
            <li>
              <strong>Click a peg</strong> to select it (turns purple)
            </li>
            <li>
              <strong>Click a green hole</strong> to jump over an adjacent peg
            </li>
            <li>The peg you jumped over is removed</li>
            <li>Goal: end with just <strong>1 peg</strong> remaining</li>
          </ul>
          <hr />
          <ul>
            <li>1 peg left — GENIUS!</li>
            <li>2 pegs — PURTY SMART</li>
            <li>3 pegs — JUST PLAIN DUMB</li>
            <li>4+ pegs — EG-NO-RA-MOOSE</li>
          </ul>
        </>
      }
    >
      <PegSolitaire />
    </StandaloneWindow>
  );
}
