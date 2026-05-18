import { useNavigate } from "react-router-dom";
import ChainReaction from "../experiences/ChainReaction/ChainReaction";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function ChainReactionPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow
      title="Chain Reaction"
      icon="🔗"
      helpContent={
        <>
          <ul>
            <li>Connect <strong>START</strong> to <strong>END</strong> through hidden words</li>
            <li>Each pair of adjacent words forms a compound word or phrase</li>
            <li>Click a <strong>frontier word</strong> (adjacent to a known word) to reveal a letter and guess</li>
            <li>Fewer hints needed = more points</li>
            <li>Score = total letters guessed ÷ total turns taken</li>
          </ul>
          <hr />
          <ul>
            <li>Use <strong>Game</strong> menu to start a new game or change chain length</li>
            <li>Press <strong>Enter</strong> to submit a guess, <strong>Esc</strong> to cancel</li>
          </ul>
        </>
      }
    >
      <ChainReaction onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
