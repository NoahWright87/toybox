import TypingRacer from "../experiences/TypingRacer/TypingRacer";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function TypingRacerPage() {
  return (
    <StandaloneWindow
      title="Type 'Em Up"
      icon="⌨️"
      helpContent={
        <ul>
          <li>Type the first letter to target the lowest matching word</li>
          <li>Keep typing to shoot it down before it reaches your ship</li>
          <li>Wrong letters make words fall faster</li>
          <li>You have 3 lives — don't let words hit your ship!</li>
          <li><strong>ESC</strong> — return to menu</li>
        </ul>
      }
    >
      <TypingRacer />
    </StandaloneWindow>
  );
}
