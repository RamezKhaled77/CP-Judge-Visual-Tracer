import { useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { FileCode2 } from "lucide-react";

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

export function CodeEditor({
  code,
  setCode,
  isPending,
}: {
  code: string;
  setCode: (value: string) => void;
  isPending: boolean;
}) {
  const lineCount = code.split("\n").length;

  const handleChange = useCallback(
    (value: string) => {
      setCode(value);
    },
    [setCode],
  );

  return (
    <section className="flex min-h-[520px] min-w-0 flex-1 flex-col bg-[#24373a]" data-testid="container-code-editor">
      <div className="flex items-center justify-between border-b border-[#496264] px-4 py-3 text-[#c4d0c8]">
        <div className="flex items-center gap-3">
          <FileCode2 size={15} className="text-[#63c9c2]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]">main.cpp</span>
          <span className="rounded bg-[#385054] px-2 py-1 font-mono text-[9px] text-[#a4bdb6]">C++17</span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#76918f]">
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </span>
      </div>

      <div className="relative min-h-[465px] flex-1 overflow-hidden font-mono text-[13px] leading-[1.6]">
        <CodeMirror
          value={code}
          height="100%"
          minHeight="465px"
          theme={cpTheme}
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

      <div className="flex items-center justify-between border-t border-[#496264] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#789492]">
        <span>stdin: problem fixture</span>
        <span>{isPending ? "compiling..." : "syntax highlighted"}</span>
      </div>
    </section>
  );
}
