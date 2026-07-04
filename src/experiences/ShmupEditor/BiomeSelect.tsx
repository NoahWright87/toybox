import { useState } from "react";

const AGNOSTIC_OPTION = "";
const NEW_BIOME_OPTION = "__new__";

interface BiomeSelectProps {
  value: string | null;
  availableBiomes: string[];
  onChange: (biome: string | null) => void;
  onRegisterBiome: (biome: string) => void;
}

/** Single dropdown picking which biome tile-set a tile belongs to, or agnostic (null). Mirrors EdgeSelect's "+ New..." commit-on-blur behavior for mobile virtual keyboards. */
export default function BiomeSelect({ value, availableBiomes, onChange, onRegisterBiome }: BiomeSelectProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  if (adding) {
    const commit = () => {
      const trimmed = draft.trim();
      if (trimmed) {
        onRegisterBiome(trimmed);
        onChange(trimmed);
      }
      setAdding(false);
      setDraft("");
    };
    return (
      <input
        autoFocus
        type="text"
        className="shmup-input"
        value={draft}
        placeholder="new biome"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setDraft("");
            setAdding(false);
          }
        }}
        onBlur={commit}
      />
    );
  }

  return (
    <select
      className="shmup-input"
      value={value ?? AGNOSTIC_OPTION}
      onChange={(e) => {
        const v = e.target.value;
        if (v === NEW_BIOME_OPTION) {
          setAdding(true);
          return;
        }
        onChange(v === AGNOSTIC_OPTION ? null : v);
      }}
    >
      <option value={AGNOSTIC_OPTION}>— Agnostic (any biome) —</option>
      {availableBiomes.map((biome) => (
        <option key={biome} value={biome}>
          {biome}
        </option>
      ))}
      <option value={NEW_BIOME_OPTION}>+ New biome...</option>
    </select>
  );
}
