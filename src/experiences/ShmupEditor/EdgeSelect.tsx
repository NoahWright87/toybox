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
}

/** One edge's tag/hard-wall control, embedded directly in the tile schematic — a single dropdown, not a text field + checkbox pair. */
export default function EdgeSelect({ slot, availableTags, onChange, onRegisterTag, disabled }: EdgeSelectProps) {
  const [adding, setAdding] = useState(false);
  const [draftTag, setDraftTag] = useState("");

  if (adding) {
    return (
      <input
        autoFocus
        type="text"
        className="shmup-edge-select shmup-edge-select--adding"
        value={draftTag}
        placeholder="new tag"
        onChange={(e) => setDraftTag(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const trimmed = draftTag.trim();
            if (trimmed) {
              onRegisterTag(trimmed);
              onChange({ tag: trimmed, hardwall: false });
            }
            setAdding(false);
            setDraftTag("");
          } else if (e.key === "Escape") {
            setAdding(false);
            setDraftTag("");
          }
        }}
        onBlur={() => {
          setAdding(false);
          setDraftTag("");
        }}
      />
    );
  }

  const value = slot.hardwall ? HARDWALL_OPTION : slot.tag;

  return (
    <select
      className="shmup-edge-select"
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
