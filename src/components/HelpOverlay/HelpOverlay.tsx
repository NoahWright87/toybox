import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Modal } from "@noahwright/design";
import "./HelpOverlay.css";

export interface HelpOverlayProps {
  /** Title shown in the instructions modal. */
  title: string;
  /** Instructions content rendered inside the modal. */
  children: React.ReactNode;
  /** Seconds of mouse inactivity before the ❓ button fades out. Default: 3. */
  inactivitySeconds?: number;
}

/**
 * Reusable help overlay for Toy Box experiences.
 *
 * Renders a floating ❓ button that:
 * - Appears on mouse move and fades after `inactivitySeconds` of no activity.
 * - Opens an instructions modal on click.
 * - Also toggles the modal when the user presses `?`.
 */
export default function HelpOverlay({
  title,
  children,
  inactivitySeconds = 3,
}: HelpOverlayProps) {
  const [buttonVisible, setButtonVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showButton = useCallback(() => {
    setButtonVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => setButtonVisible(false),
      inactivitySeconds * 1000
    );
  }, [inactivitySeconds]);

  // Show on mouse activity
  useEffect(() => {
    window.addEventListener("mousemove", showButton);
    return () => window.removeEventListener("mousemove", showButton);
  }, [showButton]);

  // `?` key toggles the modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setModalOpen((open) => !open);
        showButton();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showButton]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <>
      <div
        className={[
          "help-overlay__trigger",
          buttonVisible ? "help-overlay__trigger--visible" : "help-overlay__trigger--hidden",
        ].join(" ")}
      >
        <Button
          variant="ghost"
          color="#ffffff"
          size="medium"
          onClick={() => { setModalOpen(true); showButton(); }}
          aria-label="Show instructions"
        >
          ❓
        </Button>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={title}
        actions={[{ label: "Got it", variant: "primary", onClick: () => setModalOpen(false) }]}
      >
        {children}
      </Modal>
    </>
  );
}
