/**
 * Authored encounters — running `/shmup-editor` content in the real engine.
 *
 * The editor authors tiles, Units and Encounters and persists them into the
 * Doors 97 virtual filesystem; this module reads that back on the same
 * origin, and `EncounterRunner` plays one Encounter with the real ship,
 * weapons, Hype and economy around it. See `specs/games/shmup/authored-encounters.spec.md`.
 *
 * The pure pieces (`bezier`, `movement`, `attacks`, `scaling`, `frame`,
 * `spriteScale`) carry no Phaser dependency and are unit tested directly;
 * `EncounterRunner` is the only part that touches the scene.
 */
export * from "./authoredTypes";
export * from "./authoredContent";
export * from "./scrollModel";
export * from "./frame";
export * from "./levelLayout";
export * from "./authoredLevel";
export * from "./spriteScale";
export * from "./movement";
export * from "./attacks";
export * from "./scaling";
export * from "./assets";
export { EncounterRunner } from "./EncounterRunner";
export type { EncounterRunnerConfig } from "./EncounterRunner";
export { LevelRunner } from "./LevelRunner";
export type { LevelRunnerConfig } from "./LevelRunner";
