import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import { fsStore, type FileSystemStore } from "./FileSystemStore";

const FSContext = createContext<FileSystemStore | null>(null);

export function FSProvider({ children }: { children: ReactNode }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => fsStore.subscribe(rerender), []);

  return <FSContext.Provider value={fsStore}>{children}</FSContext.Provider>;
}

export function useFS(): FileSystemStore {
  const store = useContext(FSContext);
  if (!store) throw new Error("useFS must be used within FSProvider");
  return store;
}
