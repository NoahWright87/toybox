import NumberMuncher from "../experiences/NumberMuncher/NumberMuncher";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function NumberMuncherPage() {
  return (
    <StandaloneWindow title="Nom Nom Numerals" icon="🔢">
      <NumberMuncher />
    </StandaloneWindow>
  );
}
