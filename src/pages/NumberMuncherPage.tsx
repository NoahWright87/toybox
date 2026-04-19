import { useNavigate } from "react-router-dom";
import { Button } from "@noahwright/design";
import Draggable from "react-draggable";
import { useRef } from "react";
import NumberMuncher from "../experiences/NumberMuncher/NumberMuncher";
import "./NumberMuncherPage.css";

export default function NumberMuncherPage() {
  const navigate = useNavigate();
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <div className="number-muncher-page">
      <Draggable handle=".number-muncher-page__titlebar" bounds="parent" nodeRef={nodeRef}>
        <div ref={nodeRef} className="number-muncher-page__window">
          <div className="number-muncher-page__titlebar">Nom Nom Numerals</div>
          <NumberMuncher />
        </div>
      </Draggable>

      <div className="number-muncher-page__back">
        <Button variant="ghost" color="#ffffff" onClick={() => navigate("/")}>
          ← Toy Box
        </Button>
      </div>
    </div>
  );
}
