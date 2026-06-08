import { useNavigate } from "react-router-dom";
import GooberDressup from "../experiences/GooberDressup/GooberDressup";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function GooberDressupPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow
      title="Goober Dress-Up"
      icon="🐱"
      helpContent={
        <ul>
          <li>Click a <strong>feature name</strong> on the left to select it</li>
          <li>Use <strong>◄ ►</strong> arrows to cycle through options</li>
          <li>Draw custom art in <strong>NS Art</strong> and use<br />File &gt; Goober Dress-Up to publish it here</li>
          <li>Use <strong>Save As</strong> to name and save your Goober</li>
          <li>Use <strong>Export PNG</strong> to download an image</li>
        </ul>
      }
    >
      <GooberDressup onQuit={() => navigate("/doors97", { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
