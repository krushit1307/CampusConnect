import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  KeyboardEvent,
  useCallback,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@uiw/react-md-editor/markdown-editor.css";
import { useTheme } from "@/components/theme-provider";
import { MentionRenderer } from "@/components/MentionRenderer";
import { createClient } from "@/lib/supabase/client";
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
  AtSign,
} from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  handle: string | null;
}

export type MarkdownEditorWithMentionsProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  minHeightClass?: string;
  id?: string;
  clubId?: string;
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

export type MarkdownEditorWithMentionsRef = {
  focusWrite: () => void;
};

export const MarkdownEditorWithMentions = forwardRef<
  MarkdownEditorWithMentionsRef,
  MarkdownEditorWithMentionsProps
>(
  (
    {
      value,
      onChange,
      placeholder = "Share an update using Markdown… (Type @ to mention)",
      rows = 7,
      minHeightClass = "min-h-44",
      id,
      clubId,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<"write" | "preview">("write");

    const { theme } = useTheme();
    const [colorMode, setColorMode] = useState<"light" | "dark">("light");

    // Mention autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<Profile[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);

    const supabase = createClient();

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
          textareaRef.current?.focus();
          textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      },
    }));

    // Fetch club members
    const fetchClubMembers = useCallback(
      async (query: string) => {
        if (!clubId) return [];

        const { data, error } = await supabase
          .from("club_members")
          .select("profiles!inner(id, full_name, handle)")
          .eq("club_id", clubId)
          .eq("status", "approved");

        if (error || !data) return [];

        const profiles = data
          .map((member) => member.profiles as unknown as Profile)
          .filter((profile): profile is Profile => profile !== null && profile.handle !== null);

        if (query) {
          const lowerQuery = query.toLowerCase();
          return profiles.filter(
            (p) =>
              p.handle?.toLowerCase().includes(lowerQuery) ||
              p.full_name?.toLowerCase().includes(lowerQuery),
          );
        }

        return profiles.slice(0, 10); // Limit to 10 suggestions
      },
      [clubId, supabase],
    );

    // Handle text changes and detect @ mentions
    const handleTextChange = async (text: string) => {
      onChange(text);

      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = text.slice(0, cursorPos);

      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

        if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
          setMentionStartPos(lastAtIndex);

          const members = await fetchClubMembers(textAfterAt);
          setSuggestions(members);
          setShowSuggestions(members.length > 0);
          setSelectedIndex(0);
          return;
        }
      }

      setShowSuggestions(false);
    };

    // Handle mention selection
    const selectMention = (profile: Profile) => {
      if (!textareaRef.current || mentionStartPos === null) return;

      const beforeMention = value.slice(0, mentionStartPos);
      const afterMention = value.slice(textareaRef.current.selectionStart);
      const mentionText = `@${profile.handle}`;

      const newValue = `${beforeMention}${mentionText} ${afterMention}`;
      onChange(newValue);

      const newCursorPos = mentionStartPos + mentionText.length + 1;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);

      setShowSuggestions(false);
      setMentionStartPos(null);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case "Enter":
          if (suggestions.length > 0) {
            e.preventDefault();
            selectMention(suggestions[selectedIndex]);
          }
          break;
        case "Tab":
          if (suggestions.length > 0) {
            e.preventDefault();
            selectMention(suggestions[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowSuggestions(false);
          break;
      }
    };

    const applyMarkdown = ({
      before,
      after = "",
      placeholder: placeholderText = "text",
      linePrefix,
    }: ToolbarAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.slice(start, end) || placeholderText;
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
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);

      const newValue = `${before}@${after}`;
      onChange(newValue);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      });
    };

    // Close suggestions when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          suggestionsRef.current &&
          !suggestionsRef.current.contains(e.target as Node) &&
          textareaRef.current &&
          !textareaRef.current.contains(e.target as Node)
        ) {
          setShowSuggestions(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Scroll selected item into view
    useEffect(() => {
      if (showSuggestions && suggestionsRef.current) {
        const selectedElement = suggestionsRef.current.querySelector(
          `[data-index="${selectedIndex}"]`,
        );
        selectedElement?.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex, showSuggestions]);

    return (
      <div
        className="neu-border relative bg-white dark:bg-black"
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
            <button
              type="button"
              onClick={insertMention}
              className="neu-border bg-white p-2 transition hover:-translate-y-0.5 hover:bg-peach focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              aria-label="Mention user"
              title="Mention user (@)"
            >
              <AtSign size={16} strokeWidth={2.5} aria-hidden="true" />
            </button>
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
          <div className="relative">
            <textarea
              ref={textareaRef}
              id={id}
              value={value}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={rows}
              className={`${minHeightClass} w-full resize-y bg-white dark:bg-black p-4 font-mono text-sm outline-none placeholder:text-gray-500 focus:bg-cream/40 dark:focus:bg-gray-900 dark:text-cream`}
              aria-label="Content in Markdown"
            />

            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="neu-border absolute left-4 top-full z-50 mt-1 max-h-60 w-64 overflow-y-auto bg-white shadow-lg"
                role="listbox"
                aria-label="Mention suggestions"
              >
                {suggestions.map((profile, index) => (
                  <button
                    key={profile.id}
                    type="button"
                    data-index={index}
                    onClick={() => selectMention(profile)}
                    className={`flex w-full items-center gap-2 border-b border-black p-3 text-left transition-colors hover:bg-lime ${
                      index === selectedIndex ? "bg-cream" : ""
                    }`}
                    role="option"
                    aria-selected={index === selectedIndex}
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm font-bold">{profile.full_name}</div>
                      <div className="font-mono text-xs text-gray-600">@{profile.handle}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={`${minHeightClass} bg-white dark:bg-black p-4`} aria-live="polite">
            {value.trim() ? (
              <div className="markdown-content font-mono text-sm leading-relaxed">
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
          Raw Markdown is saved. Mention users with @username
        </div>
      </div>
    );
  },
);

MarkdownEditorWithMentions.displayName = "MarkdownEditorWithMentions";
