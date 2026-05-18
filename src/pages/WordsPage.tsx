import { useNavigate } from "react-router-dom";
import Words from "../experiences/Words/Words";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function WordsPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow
      title="WORDS"
      icon="🔤"
      helpContent={
        <ul>
          <li>Guess the hidden word — you get <strong>6 tries</strong></li>
          <li><strong>Green</strong> = right letter, right spot</li>
          <li><strong>Yellow</strong> = right letter, wrong spot</li>
          <li><strong>Gray</strong> = letter not in the word</li>
          <li>Pick word length (4–8 letters) with the buttons at the top — longer words are harder</li>
          <li>Type with your keyboard or click the on-screen keys · <strong>Enter</strong> to submit · <strong>Backspace</strong> to delete</li>
        </ul>
      }
    >
      <Words onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
