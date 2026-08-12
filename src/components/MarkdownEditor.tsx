import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MDEditor, { type RefMDEditor } from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { useTheme } from "@/components/theme-provider";
import { MentionRenderer } from "@/components/MentionRenderer";
import { TableBuilderModal } from "@/components/TableBuilderModal";
import { insertMarkdownBlock } from "@/lib/insertMarkdownBlock";
import Bold from "lucide-react/dist/esm/icons/bold";
import Code2 from "lucide-react/dist/esm/icons/code-2";
import Eye from "lucide-react/dist/esm/icons/eye";
import Heading2 from "lucide-react/dist/esm/icons/heading-2";
import Italic from "lucide-react/dist/esm/icons/italic";
import Link2 from "lucide-react/dist/esm/icons/link-2";
import List from "lucide-react/dist/esm/icons/list";
import ListOrdered from "lucide-react/dist/esm/icons/list-ordered";
import MessageSquareText from "lucide-react/dist/esm/icons/message-square-text";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Quote from "lucide-react/dist/esm/icons/quote";
import AtSign from "lucide-react/dist/esm/icons/at-sign";
import TableIcon from "lucide-react/dist/esm/icons/table";

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  minHeightClass?: string;
  id?: string;
  clubId?: string;
  enableMentions?: boolean;
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
      placeholder = "Share an update using Markdown… (Type @ to mention)",
      rows = 7,
      minHeightClass = "min-h-44",
      id,
      clubId,
      enableMentions = true,
    },
    ref,
  ) => {
    const mdEditorRef = useRef<RefMDEditor>(null);
    const [mode, setMode] = useState<"write" | "preview">("write");
    const [isTableBuilderOpen, setIsTableBuilderOpen] = useState(false);

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

    const insertMention = () => {
      const textarea = mdEditorRef.current?.textarea;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);

      // Insert @ symbol
      const newValue = `${before}@${after}`;
      onChange(newValue);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      });
    };

    const insertTableMarkdown = (markdown: string) => {
      const textarea = mdEditorRef.current?.textarea;
      if (!textarea) return;

      const { nextValue, cursorPosition } = insertMarkdownBlock(
        value,
        textarea.selectionStart,
        textarea.selectionEnd,
        markdown,
      );
      onChange(nextValue);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      });
    };

    return (
      <>
        <div
          className="neu-border bg-white dark:bg-zinc-900 dark:border-zinc-700 transition-colors"
          aria-label="Markdown editor"
          data-color-mode={colorMode}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black dark:border-zinc-700 bg-sky dark:bg-zinc-800 p-2 transition-colors">
            <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Markdown formatting">
              {toolbarActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => applyMarkdown(action)}
                    className="neu-border bg-white dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-600 p-2 transition hover:-translate-y-0.5 hover:bg-lime dark:hover:bg-lime dark:hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white"
                    aria-label={action.label}
                    title={action.label}
                  >
                    <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                );
              })}
              {enableMentions && (
                <button
                  type="button"
                  onClick={insertMention}
                  className="neu-border bg-white dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-600 p-2 transition hover:-translate-y-0.5 hover:bg-peach dark:hover:bg-peach dark:hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white"
                  aria-label="Mention user"
                  title="Mention user (@)"
                >
                  <AtSign size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsTableBuilderOpen(true)}
                className="neu-border bg-white dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-600 p-2 transition hover:-translate-y-0.5 hover:bg-lime dark:hover:bg-lime dark:hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white"
                aria-label="Insert table"
                title="Insert table"
              >
                <TableIcon size={16} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            <div className="flex" aria-label="Editor mode">
              <button
                type="button"
                onClick={() => setMode("write")}
                className={`neu-border flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase dark:border-zinc-600 transition-colors ${
                  mode === "write"
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black dark:bg-zinc-900 dark:text-zinc-100"
                }`}
                aria-pressed={mode === "write"}
              >
                <Pencil size={14} aria-hidden="true" /> Write
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`neu-border -ml-0.5 flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase dark:border-zinc-600 transition-colors ${
                  mode === "preview"
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black dark:bg-zinc-900 dark:text-zinc-100"
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
                className: `${minHeightClass} w-full resize-y bg-white dark:bg-zinc-900 text-black dark:text-zinc-100 p-4 font-mono text-sm outline-none placeholder:text-gray-500 dark:placeholder:text-zinc-500 focus:bg-cream/40 dark:focus:bg-zinc-800/50 transition-colors`,
                "aria-label": "Content in Markdown",
              }}
            />
          ) : (
            <div
              className={`${minHeightClass} bg-white dark:bg-zinc-900 p-4 transition-colors`}
              aria-live="polite"
            >
              {value.trim() ? (
                <div className="markdown-content font-mono text-sm leading-relaxed text-black dark:text-zinc-100">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p>
                          <MentionRenderer content={String(children)} />
                        </p>
                      ),
                    }}
                  >
                    {value}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-gray-500 dark:text-zinc-400">
                  <MessageSquareText size={32} aria-hidden="true" />
                  <p className="font-mono text-sm text-gray-800 dark:text-zinc-300">
                    Your Markdown preview will appear here.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="border-t-2 border-black dark:border-zinc-700 bg-cream dark:bg-zinc-800 dark:text-zinc-300 px-4 py-2 font-mono text-[10px] uppercase text-black transition-colors">
            Raw Markdown is saved. HTML is not rendered.
          </div>
        </div>

        <TableBuilderModal
          isOpen={isTableBuilderOpen}
          onClose={() => setIsTableBuilderOpen(false)}
          onInsert={insertTableMarkdown}
        />
      </>
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";
