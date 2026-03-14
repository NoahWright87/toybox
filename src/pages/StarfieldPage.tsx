import { useNavigate } from "react-router-dom";
import Starfield from "../experiences/Starfield/Starfield";
import "./StarfieldPage.css";

export default function StarfieldPage() {
  const navigate = useNavigate();

  return (
    <div className="starfield-page">
      <Starfield />
      <button
        className="starfield-page__back"
        onClick={() => navigate("/")}
        aria-label="Back to Toy Box"
      >
        ← Toy Box
      </button>
    </div>
  );
}
