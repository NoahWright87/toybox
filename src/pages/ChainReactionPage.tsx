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
            <li>Guess letters to reveal the hidden words in the chain</li>
            <li>Each word's <strong>last letter</strong> is the <strong>first letter</strong> of the next</li>
            <li>The <strong>START</strong> and <strong>END</strong> words are always revealed</li>
            <li>
              Inner words show their <strong>first and last letters</strong> as chain
              links — guess the hidden middle letters
            </li>
            <li>Correct guess: reveals that letter everywhere it appears</li>
            <li>Wrong guess: costs a life (6 lives total)</li>
            <li>Type letters on your keyboard or click the on-screen keys</li>
          </ul>
          <hr />
          <ul>
            <li>
              Use <strong>Game</strong> menu to start a new game or change chain length
            </li>
          </ul>
        </>
      }
    >
      <ChainReaction onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
