import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Bold, Italic, Link2 } from "lucide-react";

export type RichTextEditorRef = {
  focusWrite: () => void;
};

export type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function htmlToMarkdown(html: string): string {
  let md = html;

  // Handle <b> and <strong>
  md = md.replace(/<(b|strong)[^>]*>(.*?)<\/\1>/gi, "**$2**");

  // Handle <i> and <em>
  md = md.replace(/<(i|em)[^>]*>(.*?)<\/\1>/gi, "*$2*");

  // Handle <a>
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Handle blocks and line breaks
  // Chrome uses <div> for new lines, Firefox uses <br>
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n");
  md = md.replace(/<div[^>]*><br\s*\/><\/div>/gi, "\n");
  md = md.replace(/<div[^>]*>(.*?)<\/div>/gi, "\n$1");

  // Remove any remaining tags
  md = md.replace(/<[^>]*>/g, "");

  // Unescape standard HTML entities
  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&amp;/g, "&");

  return md;
}

function markdownToHtml(md: string): string {
  if (!md) return "";

  let html = md;
  // Escape HTML to prevent XSS
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="text-decoration: underline; color: blue;">$1</a>',
  );

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<i>$1</i>");

  // Newlines
  html = html.replace(/\n/g, "<br>");

  return html;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ value, onChange, placeholder = "Write something..." }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [html, setHtml] = useState(() => markdownToHtml(value));

    // Sync external value changes (like form clear) back to internal HTML state
    useEffect(() => {
      const currentMd = htmlToMarkdown(editorRef.current?.innerHTML || "");
      if (value !== currentMd) {
        const newHtml = markdownToHtml(value);
        setHtml(newHtml);
        if (editorRef.current && editorRef.current.innerHTML !== newHtml) {
          editorRef.current.innerHTML = newHtml;
        }
      }
    }, [value]);

    useImperativeHandle(ref, () => ({
      focusWrite: () => {
        editorRef.current?.focus();
      },
    }));

    const handleInput = () => {
      if (!editorRef.current) return;
      const newHtml = editorRef.current.innerHTML;
      setHtml(newHtml);
      const markdown = htmlToMarkdown(newHtml);
      onChange(markdown);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      // Fallback for document.execCommand
      document.execCommand("insertText", false, text);
    };

    const execCommand = (command: string, arg?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, arg);
      handleInput(); // ensure we capture the changes immediately
    };

    const promptLink = () => {
      const url = window.prompt("Enter link URL:", "https://");
      if (url) {
        execCommand("createLink", url);
      }
    };

    return (
      <div className="neu-border flex flex-col bg-white">
        <div
          className="flex items-center gap-1 border-b-2 border-black bg-sky p-2"
          role="toolbar"
          aria-label="Text Formatting"
        >
          <button
            type="button"
            onClick={() => execCommand("bold")}
            className="neu-border bg-white p-2 transition hover:-translate-y-0.5 hover:bg-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            aria-label="Bold"
            title="Bold"
          >
            <Bold size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => execCommand("italic")}
            className="neu-border bg-white p-2 transition hover:-translate-y-0.5 hover:bg-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            aria-label="Italic"
            title="Italic"
          >
            <Italic size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={promptLink}
            className="neu-border bg-white p-2 transition hover:-translate-y-0.5 hover:bg-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            aria-label="Link"
            title="Link"
          >
            <Link2 size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <div className="relative">
          {(!html || html === "<br>") && (
            <div className="pointer-events-none absolute left-4 top-4 font-mono text-sm text-gray-500">
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onPaste={handlePaste}
            className="min-h-32 p-4 outline-none font-mono text-sm focus:bg-cream/40"
            role="textbox"
            aria-multiline="true"
            aria-label="Rich text editor"
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    );
  },
);

RichTextEditor.displayName = "RichTextEditor";
