import { createContext, useContext, useLayoutEffect } from "react";
import type { MenuBarMenu } from "../MenuBar/MenuBar";

export const WindowMenuContext = createContext<(menus: MenuBarMenu[]) => void>(() => {});

/**
 * Register menus for the containing NS Doors 97 Window.
 * Pass a memoised menus array (useMemo) — reference equality is used to
 * avoid unnecessary Window re-renders.
 */
export function useWindowMenus(menus: MenuBarMenu[]) {
  const register = useContext(WindowMenuContext);
  useLayoutEffect(() => {
    register(menus);
  });
}
