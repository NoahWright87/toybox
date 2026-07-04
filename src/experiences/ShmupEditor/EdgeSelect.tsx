import { useState } from "react";
import { WILDCARD, type EdgeSlot } from "./types";

const HARDWALL_OPTION = "__hardwall__";
const NEW_TAG_OPTION = "__new__";

interface EdgeSelectProps {
  slot: EdgeSlot;
  availableTags: string[];
  onChange: (slot: EdgeSlot) => void;
  onRegisterTag: (tag: string) => void;
  disabled?: boolean;
  /** East/west controls sit in a narrow column — rendered rotated so the text is actually legible instead of clipped to a couple of characters. */
  vertical?: boolean;
}

/** One edge's tag/hard-wall control, embedded directly in the tile schematic — a single dropdown, not a text field + checkbox pair. */
export default function EdgeSelect({ slot, availableTags, onChange, onRegisterTag, disabled, vertical }: EdgeSelectProps) {
  const [adding, setAdding] = useState(false);
  const [draftTag, setDraftTag] = useState("");

  if (adding) {
    // Committing on blur (not just Enter) matters on mobile: virtual
    // keyboards don't reliably fire a clean keydown "Enter" (Android
    // Chrome/Gboard in particular), so relying on onKeyDown alone silently
    // discarded whatever was typed the moment the field lost focus.
    const commit = () => {
      const trimmed = draftTag.trim();
      if (trimmed) {
        onRegisterTag(trimmed);
        onChange({ tag: trimmed, hardwall: false });
      }
      setAdding(false);
      setDraftTag("");
    };
    return (
      <input
        autoFocus
        type="text"
        className={`shmup-edge-select shmup-edge-select--adding ${vertical ? "shmup-edge-select--vertical" : ""}`}
        value={draftTag}
        placeholder="new tag"
        onChange={(e) => setDraftTag(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            // Clear first so the blur Escape triggers commits nothing.
            setDraftTag("");
            setAdding(false);
          }
        }}
        onBlur={commit}
      />
    );
  }

  const value = slot.hardwall ? HARDWALL_OPTION : slot.tag;

  return (
    <select
      className={`shmup-edge-select ${vertical ? "shmup-edge-select--vertical" : ""}`}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === NEW_TAG_OPTION) {
          setAdding(true);
          return;
        }
        onChange(v === HARDWALL_OPTION ? { tag: "", hardwall: true } : { tag: v, hardwall: false });
      }}
    >
      {value === "" && <option value="">— choose —</option>}
      {value === WILDCARD && <option value={WILDCARD}>Any (connector)</option>}
      <option value={HARDWALL_OPTION}>Hard Wall</option>
      {availableTags.map((tag) => (
        <option key={tag} value={tag}>
          {tag}
        </option>
      ))}
      <option value={NEW_TAG_OPTION}>+ New tag...</option>
    </select>
  );
}
