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
  if (!html) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  let md = "";

  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      md += (node.textContent || "").replace(/\u00A0/g, " ");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toUpperCase();

      if (tag === "BR") {
        md += "\n";
      } else if (tag === "B" || tag === "STRONG") {
        md += "**";
        el.childNodes.forEach(traverse);
        md += "**";
      } else if (tag === "I" || tag === "EM") {
        md += "*";
        el.childNodes.forEach(traverse);
        md += "*";
      } else if (tag === "A") {
        md += "[";
        el.childNodes.forEach(traverse);
        md += `](${el.getAttribute("href") || ""})`;
      } else if (tag === "DIV" || tag === "P") {
        if (md.length > 0 && !md.endsWith("\n")) {
          md += "\n";
        }
        if (el.childNodes.length === 1 && el.childNodes[0].nodeName === "BR") {
          if (md === "") md += "\n";
          return;
        }
        el.childNodes.forEach(traverse);
      } else {
        el.childNodes.forEach(traverse);
      }
    }
  }

  doc.body.childNodes.forEach(traverse);
  return md;
}

function parseTextToNodes(text: string): Node[] {
  const tokenRegex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|\*.*?\*|\n)/g;
  const parts = text.split(tokenRegex);
  const nodes: Node[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (part === "\n") {
      nodes.push(document.createElement("br"));
    } else if (part.startsWith("[") && part.endsWith(")") && part.includes("](")) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const a = document.createElement("a");
        a.href = match[2];
        a.style.textDecoration = "underline";
        a.style.color = "blue";
        const childNodes = parseTextToNodes(match[1]);
        childNodes.forEach((n) => a.appendChild(n));
        nodes.push(a);
      } else {
        nodes.push(document.createTextNode(part));
      }
    } else if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const b = document.createElement("b");
      const childNodes = parseTextToNodes(part.slice(2, -2));
      childNodes.forEach((n) => b.appendChild(n));
      nodes.push(b);
    } else if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      const i = document.createElement("i");
      const childNodes = parseTextToNodes(part.slice(1, -1));
      childNodes.forEach((n) => i.appendChild(n));
      nodes.push(i);
    } else {
      nodes.push(document.createTextNode(part));
    }
  }

  return nodes;
}

function markdownToFragment(md: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (!md) return fragment;
  const nodes = parseTextToNodes(md);
  nodes.forEach((n) => fragment.appendChild(n));
  return fragment;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ value, onChange, placeholder = "Write something..." }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(!value);

    // Sync external value changes (like form clear) back to internal DOM state
    useEffect(() => {
      const currentMd = htmlToMarkdown(editorRef.current?.innerHTML || "");
      if (value !== currentMd) {
        if (editorRef.current) {
          editorRef.current.replaceChildren(markdownToFragment(value));
          const newHtml = editorRef.current.innerHTML;
          setIsEmpty(!newHtml || newHtml === "<br>");
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
      setIsEmpty(!newHtml || newHtml === "<br>");
      const markdown = htmlToMarkdown(newHtml);
      onChange(markdown);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    };

    const execCommand = (command: string, arg?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, arg);
      handleInput();
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
          {isEmpty && (
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
          />
        </div>
      </div>
    );
  },
);

RichTextEditor.displayName = "RichTextEditor";
