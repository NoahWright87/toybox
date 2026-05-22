import Pinball from "../experiences/Pinball/Pinball";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function PinballPage() {
  return (
    <StandaloneWindow
      title="Pinball"
      icon="🎮"
      helpContent={
        <ul>
          <li><strong>Space</strong> — hold to charge plunger, release to launch</li>
          <li><strong>Z or ←</strong> — left flipper</li>
          <li><strong>X or →</strong> — right flipper</li>
          <li>Hit bumpers for points, light all lanes for a multiplier bonus</li>
          <li>3 balls — don&apos;t let them drain!</li>
        </ul>
      }
    >
      <Pinball />
    </StandaloneWindow>
  );
}
