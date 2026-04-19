import { useNavigate } from "react-router-dom";
import { Button } from "@noahwright/design";
import NumberMuncher from "../experiences/NumberMuncher/NumberMuncher";
import "./NumberMuncherPage.css";

export default function NumberMuncherPage() {
  const navigate = useNavigate();

  return (
    <div className="number-muncher-page">
      <div className="number-muncher-page__window">
        <div className="number-muncher-page__titlebar">Nom Nom Numerals</div>
        <NumberMuncher />
      </div>

      <div className="number-muncher-page__back">
        <Button variant="ghost" color="#ffffff" onClick={() => navigate("/")}>
          ← Toy Box
        </Button>
      </div>
    </div>
  );
}
