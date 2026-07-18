// TODO: Build a component gallery for Window sub-components (TitleBar, MenuBar, ResizeHandles).
// Route: /component-test
// Show each component in isolation with labeled states:
//   - TitleBar: normal, maximized (Embiggen active), all buttons, no Shrink/Embiggen
//   - MenuBar: default menus, custom menus, disabled items, checked items
//   - ResizeHandles: a resizable box demonstrating all 8 directions
// Use the dark page-background radial gradient and the Win95 gray panel style.
import { useState } from "react";
import { Dial } from "../components/Dial/Dial";

/** Dial showcase (shmup-editor.todo.md, E3 #193 follow-up) — clamped, unclamped, nudge buttons, and a custom formatter, side by side so drag/reset/type-to-edit can be checked against each mode before wiring the component into anything real. */
function DialGallery() {
  const [clampedVal, setClampedVal] = useState(50);
  const [unclampedVal, setUnclampedVal] = useState(0);
  const [nudgeVal, setNudgeVal] = useState(4);
  const [percentVal, setPercentVal] = useState(30);

  return (
    <div style={{ display: "flex", gap: 32, flexWrap: "wrap", background: "#c0c0c0", padding: 24, border: "2px solid", borderColor: "#808080 #ffffff #ffffff #808080" }}>
      <Dial label="Clamped 0-100" value={clampedVal} onChange={setClampedVal} min={0} max={100} />
      <Dial label="Unclamped" value={unclampedVal} onChange={setUnclampedVal} step={1} />
      <Dial label="Nudge buttons" value={nudgeVal} onChange={setNudgeVal} min={0} max={10} showNudgeButtons />
      <Dial label="Custom format" value={percentVal} onChange={setPercentVal} min={0} max={100} formatValue={(v) => `${v}%`} />
    </div>
  );
}

export default function ComponentTestPage() {
  return (
    <div style={{ padding: 32, fontFamily: "'Press Start 2P', monospace", fontSize: 10, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 12 }}>Dial</h2>
      <DialGallery />
    </div>
  );
}
