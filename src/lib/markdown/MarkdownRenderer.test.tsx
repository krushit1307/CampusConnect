import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { parse } from "./parser";

describe("MarkdownRenderer", () => {
  it("renders a heading", () => {
    const { container } = render(<MarkdownRenderer source="# Hello" />);
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe("Hello");
  });

  it("renders a paragraph with bold", () => {
    const { container } = render(<MarkdownRenderer source="This is **bold** text." />);
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe("bold");
  });

  it("renders a paragraph with italic", () => {
    const { container } = render(<MarkdownRenderer source="This is *italic* text." />);
    const em = container.querySelector("em");
    expect(em).not.toBeNull();
    expect(em?.textContent).toBe("italic");
  });

  it("renders inline code", () => {
    const { container } = render(<MarkdownRenderer source="Use `npm install`." />);
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("npm install");
  });

  it("renders a code block", () => {
    const { container } = render(<MarkdownRenderer source={"```ts\nconst x = 1;\n```"} />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    const code = pre?.querySelector("code");
    expect(code?.textContent).toBe("const x = 1;");
    expect(code?.className).toContain("language-ts");
  });

  it("renders a link with safe href", () => {
    const { container } = render(<MarkdownRenderer source="[click](https://example.com)" />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("renders an image with safe src", () => {
    const { container } = render(<MarkdownRenderer source="![alt](https://example.com/img.png)" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/img.png");
    expect(img?.getAttribute("alt")).toBe("alt");
  });

  it("renders an unordered list", () => {
    const { container } = render(<MarkdownRenderer source={"- A\n- B\n- C"} />);
    const ul = container.querySelector("ul");
    expect(ul).not.toBeNull();
    const items = ul?.querySelectorAll("li");
    expect(items?.length).toBe(3);
  });

  it("renders an ordered list with start", () => {
    const { container } = render(<MarkdownRenderer source={"1. A\n2. B"} />);
    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
    expect(ol?.getAttribute("start")).toBe("1");
    const items = ol?.querySelectorAll("li");
    expect(items?.length).toBe(2);
  });

  it("renders a task-list item with a checkbox", () => {
    const { container } = render(<MarkdownRenderer source="- [x] Done" />);
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.hasAttribute("checked")).toBe(true);
  });

  it("renders a blockquote", () => {
    const { container } = render(<MarkdownRenderer source="> quoted text" />);
    const bq = container.querySelector("blockquote");
    expect(bq).not.toBeNull();
    expect(bq?.textContent).toContain("quoted text");
  });

  it("renders a thematic break", () => {
    const { container } = render(<MarkdownRenderer source={"---"} />);
    const hr = container.querySelector("hr");
    expect(hr).not.toBeNull();
  });

  it("renders a strikethrough", () => {
    const { container } = render(<MarkdownRenderer source="~~deleted~~" />);
    const del = container.querySelector("del");
    expect(del).not.toBeNull();
    expect(del?.textContent).toBe("deleted");
  });

  it("accepts a pre-parsed AST", () => {
    const ast = parse("# From AST");
    const { container } = render(<MarkdownRenderer ast={ast} />);
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe("From AST");
  });

  it("renders nothing for empty input", () => {
    const { container } = render(<MarkdownRenderer source="" />);
    expect(container.querySelector("div")?.children.length).toBe(0);
  });

  // ── Security: XSS tests ────────────────────────────────────────────────

  it("does NOT render a <script> tag from inline content", () => {
    const source = "Hello <script>alert('xss')</script> world";
    const { container } = render(<MarkdownRenderer source={source} />);
    // React escapes the <script> tag as text, so no script element exists.
    expect(container.querySelector("script")).toBeNull();
  });

  it("does NOT execute a javascript: link", () => {
    const source = "[click](javascript:alert(1))";
    const { container } = render(<MarkdownRenderer source={source} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("#");
  });

  it("does NOT render a data: image", () => {
    const source = "![x](data:text/html,<script>alert(1)</script>)";
    const { container } = render(<MarkdownRenderer source={source} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("#");
  });

  it("renders text that looks like HTML as plain text", () => {
    const source = "<b>not really bold</b>";
    const { container } = render(<MarkdownRenderer source={source} />);
    // There should be no <b> element — it's plain text.
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>not really bold</b>");
  });

  it("does not use dangerouslySetInnerHTML (verify via source absence)", () => {
    // This is a structural guarantee: the renderer walks the AST and returns
    // React elements. We verify the DOM output is escaped, which proves
    // dangerouslySetInnerHTML was not used.
    const source = '<img src=x onerror="alert(1)">';
    const { container } = render(<MarkdownRenderer source={source} />);
    const img = container.querySelector("img");
    // If dangerouslySetInnerHTML were used, the <img> tag would be a real
    // element with an onerror attribute. Because we render text, it's escaped.
    expect(img).toBeNull();
  });
});
