/**
 * The single composition root for save/settings storage (S1 #171). Every
 * other module imports `saveStore` from here and the `SaveStore` type —
 * never `DoorsFsSaveStore`/`LocalSaveStore` directly — so the backing
 * mechanism stays swappable behind one switch.
 */
import type { SaveStore } from "./types";
import { DoorsFsSaveStore } from "./doorsFsSaveStore";
import { LocalSaveStore } from "./localSaveStore";

export type { SaveStore } from "./types";

const SAVE_BACKEND: "doors-fs" | "local" = "doors-fs";

export const saveStore: SaveStore =
  SAVE_BACKEND === "doors-fs" ? new DoorsFsSaveStore() : new LocalSaveStore();
