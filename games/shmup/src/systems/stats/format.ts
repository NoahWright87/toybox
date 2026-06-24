/** Shared value formatter, keyed by StatDef.unit (stats.spec.md: "%, x, flat, px"). */
import type { StatDef } from "./types";

export function formatStatValue(def: StatDef, value: number): string {
  switch (def.unit) {
    case "percent":
      return `${(value * 100).toFixed(0)}%`;
    case "multiplier":
      return `${value.toFixed(2)}×`;
    case "px":
      return `${value.toFixed(0)}px`;
    case "flat":
    default:
      return value.toFixed(Number.isInteger(value) ? 0 : 1);
  }
}
