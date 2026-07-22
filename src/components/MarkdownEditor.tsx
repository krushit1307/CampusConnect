import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MDEditor, { type RefMDEditor } from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { useTheme } from "@/components/theme-provider";
import {
  Bold,
  Code2,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareText,
  Pencil,
  Quote,
} from "lucide-react";

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  minHeightClass?: string;
  id?: string;
};

type ToolbarAction = {
  label: string;
  icon: typeof Bold;
  before: string;
  after?: string;
  placeholder?: string;
  linePrefix?: boolean;
};

const toolbarActions: ToolbarAction[] = [
  { label: "Bold", icon: Bold, before: "**", after: "**", placeholder: "bold text" },
  { label: "Italic", icon: Italic, before: "*", after: "*", placeholder: "italic text" },
  { label: "Heading", icon: Heading2, before: "## ", placeholder: "Heading", linePrefix: true },
  { label: "Bulleted list", icon: List, before: "- ", placeholder: "List item", linePrefix: true },
  {
    label: "Numbered list",
    icon: ListOrdered,
    before: "1. ",
    placeholder: "List item",
    linePrefix: true,
  },
  { label: "Quote", icon: Quote, before: "> ", placeholder: "Quote", linePrefix: true },
  { label: "Inline code", icon: Code2, before: "`", after: "`", placeholder: "code" },
  {
    label: "Link",
    icon: Link2,
    before: "[",
    after: "](https://example.com)",
    placeholder: "link text",
  },
];

export type MarkdownEditorRef = {
  focusWrite: () => void;
};

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  (
    {
      value,
      onChange,
      placeholder = "Share an update using Markdown…",
      rows = 7,
      minHeightClass = "min-h-44",
      id,
    },
    ref,
  ) => {
    const mdEditorRef = useRef<RefMDEditor>(null);
    const [mode, setMode] = useState<"write" | "preview">("write");

    const { theme } = useTheme();
    const [colorMode, setColorMode] = useState<"light" | "dark">("light");

    useEffect(() => {
      const isDark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setColorMode(isDark ? "dark" : "light");

      if (theme === "system") {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
          setColorMode(e.matches ? "dark" : "light");
        };
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }
    }, [theme]);

    useImperativeHandle(ref, () => ({
      focusWrite: () => {
        setMode("write");
        requestAnimationFrame(() => {
          const textarea = mdEditorRef.current?.textarea;
          textarea?.focus();
          textarea?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      },
    }));

    const applyMarkdown = ({
      before,
      after = "",
      placeholder = "text",
      linePrefix,
    }: ToolbarAction) => {
      const textarea = mdEditorRef.current?.textarea;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.slice(start, end) || placeholder;
      const prefix = linePrefix && start > 0 && value[start - 1] !== "\n" ? `\n${before}` : before;
      const replacement = `${prefix}${selectedText}${after}`;
      const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

      onChange(nextValue);

      requestAnimationFrame(() => {
        textarea.focus();
        const selectionStart = start + prefix.length;
        textarea.setSelectionRange(selectionStart, selectionStart + selectedText.length);
      });
    };

    return (
      <div
        className="neu-border bg-white dark:bg-black"
        aria-label="Markdown editor"
        data-color-mode={colorMode}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black bg-sky p-2">
          <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Markdown formatting">
            {toolbarActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => applyMarkdown(action)}
                  className="neu-border bg-white p-2 transition hover:-translate-y-0.5 hover:bg-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  aria-label={action.label}
                  title={action.label}
                >
                  <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className="flex" aria-label="Editor mode">
            <button
              type="button"
              onClick={() => setMode("write")}
              className={`neu-border flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase ${
                mode === "write" ? "bg-black text-cream" : "bg-white"
              }`}
              aria-pressed={mode === "write"}
            >
              <Pencil size={14} aria-hidden="true" /> Write
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`neu-border -ml-0.5 flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase ${
                mode === "preview" ? "bg-black text-cream" : "bg-white"
              }`}
              aria-pressed={mode === "preview"}
            >
              <Eye size={14} aria-hidden="true" /> Preview
            </button>
          </div>
        </div>

        {mode === "write" ? (
          <MDEditor
            ref={mdEditorRef}
            value={value}
            onChange={(val) => onChange(val || "")}
            preview="edit"
            hideToolbar={true}
            height="auto"
            style={{ minHeight: "200px" }}
            textareaProps={{
              id: id,
              placeholder: placeholder,
              rows: rows,
              className: `${minHeightClass} w-full resize-y bg-white p-4 font-mono text-sm outline-none placeholder:text-gray-500 focus:bg-cream/40`,
              "aria-label": "Content in Markdown",
            }}
          />
        ) : (
          <div className={`${minHeightClass} bg-white dark:bg-black p-4`} aria-live="polite">
            {value.trim() ? (
              <div className="markdown-content font-mono text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-gray-500">
                <MessageSquareText size={32} aria-hidden="true" />
                <p className="font-mono text-sm text-gray-800 dark:text-cream">
                  Your Markdown preview will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="border-t-2 border-black bg-cream dark:bg-gray-800 dark:text-cream px-4 py-2 font-mono text-[10px] uppercase">
          Raw Markdown is saved. HTML is not rendered.
        </div>
      </div>
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";
