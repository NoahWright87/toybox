import { Link } from "react-router-dom";
import PinballEditor from "../experiences/PinballEditor/PinballEditor";
import "./PinballEditorPage.css";

export default function PinballEditorPage() {
  return (
    <div className="pinball-editor-page">
      <div className="pinball-editor-page__header">
        <Link to="/pinball" className="pinball-editor-page__back">← Back to Pinball</Link>
        <span className="pinball-editor-page__title">🎮 Pinball Editor</span>
        <span className="pinball-editor-page__hint">Auto-saved to browser storage</span>
      </div>
      <div className="pinball-editor-page__body">
        <PinballEditor />
      </div>
    </div>
  );
}
