"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/explorer";
import { applyTheme, ExplorerTheme } from "@/lib/explorer-client";

export interface ThemeState {
  theme: ExplorerTheme;
}

export interface ThemeActions {
  setTheme: (theme: ExplorerTheme) => void;
}

export type ThemeMeta = Record<string, never>;

export interface ThemeContextValue {
  state: ThemeState;
  actions: ThemeActions;
  meta: ThemeMeta;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ExplorerProvider.");
  }

  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ExplorerTheme>("system");

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ExplorerTheme | null;
    const initialTheme = savedTheme || "system";
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemePreferenceChange = () => {
      const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || "system";
      if (currentTheme === "system") {
        applyTheme("system");
      }
    };

    const timeoutId = window.setTimeout(() => {
      setThemeState(initialTheme);
      applyTheme(initialTheme);
    }, 0);

    mediaQuery.addEventListener("change", handleThemePreferenceChange);
    return () => {
      window.clearTimeout(timeoutId);
      mediaQuery.removeEventListener("change", handleThemePreferenceChange);
    };
  }, []);

  const setTheme = useCallback((nextTheme: ExplorerTheme) => {
    setThemeState(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      state: { theme },
      actions: { setTheme },
      meta: {},
    }),
    [setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
