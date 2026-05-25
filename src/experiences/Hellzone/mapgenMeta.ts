// Editor-only room type metadata (emoji labels).
// Kept separate so mapgen.ts stays pure and import-free.

export const ROOM_TYPES_META: Record<string, { emoji: string | null }> = {
  none:            { emoji: null },
  start:           { emoji: '🚀' },
  exit:            { emoji: '🚪' },
  boss:            { emoji: '💀' },
  miniboss:        { emoji: '👹' },
  combat:          { emoji: '⚔️' },
  safe:            { emoji: '💊' },
  weapon:          { emoji: '🔫' },
  treasure:        { emoji: '💎' },
  key:             { emoji: '🗝️' },
  secret_treasure: { emoji: '🌟' },
  secret_shortcut: { emoji: '⚡' },
};
