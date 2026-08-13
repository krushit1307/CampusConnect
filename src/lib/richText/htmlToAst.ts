import type { RichTextDocument, RichTextNode, RichTextText } from "./types";

const allowed = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "STRONG",
  "B",
  "EM",
  "I",
  "CODE",
  "PRE",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "BR",
  "A",
  "IMG",
]);

const leaf = (text: string, marks: Partial<RichTextText> = {}): RichTextText => ({
  text,
  ...marks,
});

function inline(node: Node, marks: Partial<RichTextText> = {}): RichTextText[] {
  if (node.nodeType === Node.TEXT_NODE) return [leaf(node.textContent ?? "", marks)];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  if (!allowed.has(el.tagName)) return Array.from(el.childNodes).flatMap((n) => inline(n, marks));
  const next = { ...marks };
  if (el.tagName === "STRONG" || el.tagName === "B") next.bold = true;
  if (el.tagName === "EM" || el.tagName === "I") next.italic = true;
  if (el.tagName === "CODE") next.code = true;
  if (el.tagName === "A") {
    const href = el.getAttribute("href");
    if (href && /^https?:\/\//.test(href)) next.link = href;
  }
  if (el.tagName === "BR") return [leaf("")];
  return Array.from(el.childNodes).flatMap((n) => inline(n, next));
}

function children(el: Element): RichTextText[] {
  const result = Array.from(el.childNodes).flatMap((n) => inline(n));
  return result.length ? result : [leaf("")];
}

function block(el: Element): RichTextNode | null {
  const tag = el.tagName;
  if (!allowed.has(tag)) return null;
  if (tag === "P") return { type: "paragraph", children: children(el) };
  if (/^H[1-6]$/.test(tag))
    return {
      type: "heading",
      level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6,
      children: children(el),
    };
  if (tag === "PRE") return { type: "code_block", children: [{ text: el.textContent ?? "" }] };
  if (tag === "IMG") {
    const url = el.getAttribute("src");
    if (!url || !/^https?:\/\//.test(url)) return null;
    return {
      type: "image",
      url,
      alt: el.getAttribute("alt") ?? undefined,
      title: el.getAttribute("title") ?? undefined,
      children: [{ text: "" }],
    };
  }
  if (tag === "BLOCKQUOTE")
    return {
      type: "blockquote",
      children: Array.from(el.children).map(block).filter(Boolean) as RichTextNode[],
    };
  if (tag === "UL" || tag === "OL")
    return {
      type: tag === "UL" ? "bullet_list" : "ordered_list",
      children: Array.from(el.children).map(block).filter(Boolean) as RichTextNode[],
    };
  if (tag === "LI")
    return {
      type: "list_item",
      children: Array.from(el.children).length
        ? (Array.from(el.children).map(block).filter(Boolean) as RichTextNode[])
        : [{ type: "paragraph", children: children(el) }],
    };
  return { type: "paragraph", children: children(el) };
}

export function htmlToRichTextAst(html: string): RichTextDocument {
  const doc = new DOMParser().parseFromString(html || "<p></p>", "text/html");
  const result = Array.from(doc.body.children).map(block).filter(Boolean) as RichTextNode[];
  return result.length
    ? result
    : [{ type: "paragraph", children: [{ text: doc.body.textContent ?? "" }] }];
}
