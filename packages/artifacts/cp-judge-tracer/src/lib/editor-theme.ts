import { useEffect, useState } from "react";

// Shared with the Workbench code editor (code-editor.tsx) so the Trace Player's
// read-only source view follows the same saved theme preference. Keep this key
// in sync with the one declared there.
export const EDITOR_THEME_KEY = "cp-editor-theme";

export type EditorThemeMode = "dark" | "light";

export function readEditorTheme(): EditorThemeMode {
  try {
    return localStorage.getItem(EDITOR_THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useEditorTheme() {
  const [theme, setTheme] = useState<EditorThemeMode>(readEditorTheme);

  useEffect(() => {
    try {
      localStorage.setItem(EDITOR_THEME_KEY, theme);
    } catch {
      /* storage may be unavailable */
    }
  }, [theme]);

  // Reflect theme changes made in another view (e.g. the Workbench editor) so
  // a shared trace link opened first still matches the user's chosen theme.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === EDITOR_THEME_KEY) setTheme(readEditorTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return { theme, setTheme, toggle };
}
