import { createContext, useContext, useLayoutEffect } from "react";

export const WindowTitleContext = createContext<(suffix: string | null) => void>(() => {});

/**
 * Registers a suffix appended to the containing window's title bar
 * ("Base Title - suffix"), or clears it back to the base title when
 * `suffix` is null. Mirrors useWindowMenus.ts's register-via-context
 * pattern exactly.
 */
export function useWindowTitle(suffix: string | null) {
  const register = useContext(WindowTitleContext);
  useLayoutEffect(() => {
    register(suffix);
  });
}
