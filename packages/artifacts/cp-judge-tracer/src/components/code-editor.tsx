import { useCallback, useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { Check, Copy, FileCode2, Moon, RotateCcw, Sun } from "lucide-react";

const cpTheme = createTheme({
  theme: "dark",
  settings: {
    background: "#24373a",
    backgroundImage: "",
    foreground: "#e8f0ec",
    caret: "#63c9c2",
    selection: "#385458",
    selectionMatch: "#44686d",
    lineHighlight: "#2b4044",
    gutterBackground: "#1e3032",
    gutterForeground: "#6b8684",
    gutterBorder: "#344e51",
  },
  styles: [
    { tag: t.comment, color: "#76918f", fontStyle: "italic" },
    { tag: t.keyword, color: "#f27f6a", fontWeight: "bold" },
    { tag: [t.typeName, t.className], color: "#63c9c2", fontWeight: "600" },
    { tag: [t.string, t.special(t.string)], color: "#f2cc68" },
    { tag: t.number, color: "#7ca8ef" },
    { tag: t.operator, color: "#e66f5c" },
    { tag: t.function(t.variableName), color: "#a5d6a7" },
    { tag: t.definition(t.variableName), color: "#ffffff" },
    { tag: t.variableName, color: "#d2ded8" },
    { tag: t.attributeName, color: "#f2cc68" },
    { tag: t.heading, color: "#f27f6a", fontWeight: "bold" },
    { tag: t.processingInstruction, color: "#e66f5c" },
  ],
});

const cpLightTheme = createTheme({
  theme: "light",
  settings: {
    background: "#f6f8fa",
    backgroundImage: "",
    foreground: "#1f2328",
    caret: "#0b6e6a",
    selection: "#bfe3e0",
    selectionMatch: "#a9d8d4",
    lineHighlight: "#eaeef0",
    gutterBackground: "#eef1f3",
    gutterForeground: "#6a737d",
    gutterBorder: "#d0d7de",
  },
  styles: [
    { tag: t.comment, color: "#6e7781", fontStyle: "italic" },
    { tag: t.keyword, color: "#cf222e", fontWeight: "bold" },
    { tag: [t.typeName, t.className], color: "#0b5e5b", fontWeight: "600" },
    { tag: [t.string, t.special(t.string)], color: "#0a7d3c" },
    { tag: t.number, color: "#953800" },
    { tag: t.operator, color: "#cb4b16" },
    { tag: t.function(t.variableName), color: "#6f42c1" },
    { tag: t.definition(t.variableName), color: "#1f2328" },
    { tag: t.variableName, color: "#24292f" },
    { tag: t.attributeName, color: "#0550ae" },
    { tag: t.heading, color: "#cf222e", fontWeight: "bold" },
    { tag: t.processingInstruction, color: "#cb4b16" },
  ],
});

const EDITOR_THEME_KEY = "cp-editor-theme";

type EditorThemeMode = "dark" | "light";

const darkChrome = {
  section: "bg-[#24373a]",
  border: "border-[#496264]",
  barText: "text-[#c4d0c8]",
  fileIcon: "text-[#63c9c2]",
  fileLabel: "text-[#c4d0c8]",
  badgeBg: "bg-[#385054]",
  badgeText: "text-[#a4bdb6]",
  btnBorder: "border-[#496264]",
  btnText: "text-[#a4bdb6]",
  btnHover: "hover:border-[#63c9c2] hover:text-[#63c9c2]",
  accent: "text-[#63c9c2]",
  muted: "text-[#76918f]",
  bottom: "text-[#789492]",
};

const lightChrome = {
  section: "bg-[#f6f8fa]",
  border: "border-[#d0d7de]",
  barText: "text-[#57606a]",
  fileIcon: "text-[#0b6e6a]",
  fileLabel: "text-[#1f2328]",
  badgeBg: "bg-[#e7eef0]",
  badgeText: "text-[#0b6e6a]",
  btnBorder: "border-[#d0d7de]",
  btnText: "text-[#57606a]",
  btnHover: "hover:border-[#0b6e6a] hover:text-[#0b6e6a]",
  accent: "text-[#0b6e6a]",
  muted: "text-[#6e7781]",
  bottom: "text-[#57606a]",
};

export function CodeEditor({
  code,
  setCode,
  isPending,
  onReset,
}: {
  code: string;
  setCode: (value: string) => void;
  isPending: boolean;
  onReset: () => void;
}) {
  const lineCount = code.split("\n").length;
  const [copied, setCopied] = useState(false);
  const [editorTheme, setEditorTheme] = useState<EditorThemeMode>(() =>
    localStorage.getItem(EDITOR_THEME_KEY) === "light" ? "light" : "dark",
  );

  useEffect(() => {
    localStorage.setItem(EDITOR_THEME_KEY, editorTheme);
  }, [editorTheme]);

  const isDark = editorTheme === "dark";
  const chrome = isDark ? darkChrome : lightChrome;
  const activeTheme = isDark ? cpTheme : cpLightTheme;

  const handleChange = useCallback(
    (value: string) => {
      setCode(value);
    },
    [setCode],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [code]);

  const toggleTheme = useCallback(() => {
    setEditorTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <section
      className={`flex min-h-[520px] min-w-0 flex-1 flex-col ${chrome.section}`}
      data-testid="container-code-editor"
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${chrome.border} ${chrome.barText}`}
      >
        <div className="flex items-center gap-3">
          <FileCode2 size={15} className={chrome.fileIcon} />
          <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${chrome.fileLabel}`}>
            main.cpp
          </span>
          <span
            className={`rounded px-2 py-1 font-mono text-[9px] ${chrome.badgeBg} ${chrome.badgeText}`}
          >
            C++17
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            disabled={isPending}
            data-testid="button-reset-editor"
            className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${chrome.btnBorder} ${chrome.btnText} ${chrome.btnHover}`}
          >
            <RotateCcw size={12} /> reset
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={isPending}
            data-testid="button-copy-code"
            className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${chrome.btnBorder} ${chrome.btnText} ${chrome.btnHover}`}
          >
            {copied ? (
              <Check size={12} className={chrome.accent} />
            ) : (
              <Copy size={12} />
            )}{" "}
            {copied ? "copied" : "copy"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle editor theme"
            data-testid="button-toggle-theme"
            className={`flex items-center rounded border px-2 py-1 transition-colors ${chrome.btnBorder} ${chrome.btnText} ${chrome.btnHover}`}
          >
            {isDark ? <Sun size={12} /> : <Moon size={12} />}
          </button>
          <span
            className={`font-mono text-[9px] uppercase tracking-[0.12em] ${chrome.muted}`}
          >
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
        </div>
      </div>

      <div className="relative min-h-[465px] flex-1 overflow-hidden font-mono text-[13px] leading-[1.6]">
        <CodeMirror
          value={code}
          height="100%"
          minHeight="465px"
          theme={activeTheme}
          extensions={[cpp()]}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            indentOnInput: true,
            tabSize: 2,
          }}
          className="h-full overflow-auto"
        />
      </div>

      <div
        className={`flex items-center justify-between border-t px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] ${chrome.border} ${chrome.bottom}`}
      >
        <span>stdin: problem fixture</span>
        <span>{isPending ? "compiling..." : "syntax highlighted"}</span>
      </div>
    </section>
  );
}
