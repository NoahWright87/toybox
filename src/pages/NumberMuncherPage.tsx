import { useNavigate } from "react-router-dom";
import NumberMuncher from "../experiences/NumberMuncher/NumberMuncher";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function NumberMuncherPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow title="Nom Nom Numerals" icon="🔢">
      <NumberMuncher onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
