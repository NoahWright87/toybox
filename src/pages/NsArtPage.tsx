import NsArt from "../experiences/NsArt/NsArt";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function NsArtPage() {
  return (
    <StandaloneWindow
      title="NS Art"
      icon="🎨"
      helpContent={
        <ul>
          <li><strong>Left-click</strong> draws with primary color · <strong>Right-click</strong> draws with secondary color</li>
          <li>Left-click palette to set primary · right-click palette to set secondary</li>
          <li>Checkerboard swatch = transparent (erases to transparent)</li>
          <li><strong>Zoom tool</strong> — left-click to zoom in · right-click to zoom out (max 4×)</li>
          <li><strong>Shape tools</strong> — choose outline / filled / both from the toolbox</li>
          <li><strong>Ctrl+Z</strong> — undo (5 levels)</li>
          <li><strong>Export PNG</strong> — downloads your drawing (transparency preserved)</li>
          <li><strong>New</strong> — clears the canvas (undoable)</li>
        </ul>
      }
    >
      <NsArt />
    </StandaloneWindow>
  );
}
