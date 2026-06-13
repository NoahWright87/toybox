import { useNavigate } from "react-router-dom";
import BrickBreaker from "../experiences/BrickBreaker/BrickBreaker";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function BrickBreakerPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow title="Brick Breaker" icon="🧱">
      <BrickBreaker onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
