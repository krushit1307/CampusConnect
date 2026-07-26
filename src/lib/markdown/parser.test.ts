import { describe, it, expect } from "vitest";
import { parse, parseInline } from "./parser";

describe("parse — block-level", () => {
  it("parses an empty string into an empty root", () => {
    const ast = parse("");
    expect(ast).toEqual({ type: "root", children: [] });
  });

  it("parses a level-1 heading", () => {
    const ast = parse("# Hello");
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({ type: "heading", depth: 1 });
  });

  it("parses all heading depths 1–6", () => {
    for (let depth = 1; depth <= 6; depth++) {
      const ast = parse(`${"#".repeat(depth)} Title`);
      expect(ast.children[0]).toMatchObject({ type: "heading", depth });
    }
  });

  it("parses a paragraph with inline bold", () => {
    const ast = parse("This is **bold** text.");
    const para = ast.children[0];
    expect(para).toMatchObject({ type: "paragraph" });
    const children = (para as { children: { type: string }[] }).children;
    expect(children.some((c) => c.type === "bold")).toBe(true);
  });

  it("parses a fenced code block with language", () => {
    const ast = parse("```ts\nconst x = 1;\n```");
    expect(ast.children[0]).toMatchObject({
      type: "codeBlock",
      lang: "ts",
      value: "const x = 1;",
    });
  });

  it("parses a fenced code block with ~~~", () => {
    const ast = parse("~~~python\nprint('hi')\n~~~");
    expect(ast.children[0]).toMatchObject({
      type: "codeBlock",
      lang: "python",
      value: "print('hi')",
    });
  });

  it("parses a thematic break (---)", () => {
    const ast = parse("---");
    expect(ast.children[0]).toMatchObject({ type: "thematicBreak" });
  });

  it("parses a thematic break (***)", () => {
    const ast = parse("***");
    expect(ast.children[0]).toMatchObject({ type: "thematicBreak" });
  });

  it("parses a blockquote", () => {
    const ast = parse("> This is a quote");
    expect(ast.children[0]).toMatchObject({ type: "blockquote" });
  });

  it("parses consecutive blockquote lines into one blockquote", () => {
    const ast = parse("> Line 1\n> Line 2");
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({ type: "blockquote" });
  });

  it("parses an unordered list with -", () => {
    const ast = parse("- Item 1\n- Item 2");
    expect(ast.children[0]).toMatchObject({ type: "unorderedList" });
    const list = ast.children[0] as { children: unknown[] };
    expect(list.children).toHaveLength(2);
  });

  it("parses an unordered list with *", () => {
    const ast = parse("* A\n* B");
    expect(ast.children[0]).toMatchObject({ type: "unorderedList" });
  });

  it("parses an ordered list", () => {
    const ast = parse("1. First\n2. Second");
    expect(ast.children[0]).toMatchObject({ type: "orderedList", start: 1 });
    const list = ast.children[0] as { children: unknown[] };
    expect(list.children).toHaveLength(2);
  });

  it("parses a task-list item with [x]", () => {
    const ast = parse("- [x] Done");
    const list = ast.children[0] as {
      children: { task?: boolean; checked?: boolean }[];
    };
    expect(list.children[0].task).toBe(true);
    expect(list.children[0].checked).toBe(true);
  });

  it("parses a task-list item with [ ]", () => {
    const ast = parse("- [ ] Todo");
    const list = ast.children[0] as {
      children: { task?: boolean; checked?: boolean }[];
    };
    expect(list.children[0].task).toBe(true);
    expect(list.children[0].checked).toBe(false);
  });

  it("skips blank lines", () => {
    const ast = parse("Hello\n\nWorld");
    expect(ast.children).toHaveLength(2);
    expect(ast.children[0]).toMatchObject({ type: "paragraph" });
    expect(ast.children[1]).toMatchObject({ type: "paragraph" });
  });
});

describe("parseInline — inline-level", () => {
  it("parses plain text", () => {
    const nodes = parseInline("just text");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: "text", value: "just text" });
  });

  it("parses bold with **", () => {
    const nodes = parseInline("**bold**");
    expect(nodes[0]).toMatchObject({ type: "bold" });
  });

  it("parses bold with __", () => {
    const nodes = parseInline("__bold__");
    expect(nodes[0]).toMatchObject({ type: "bold" });
  });

  it("parses italic with *", () => {
    const nodes = parseInline("*italic*");
    expect(nodes[0]).toMatchObject({ type: "italic" });
  });

  it("parses italic with _", () => {
    const nodes = parseInline("_italic_");
    expect(nodes[0]).toMatchObject({ type: "italic" });
  });

  it("parses strikethrough", () => {
    const nodes = parseInline("~~struck~~");
    expect(nodes[0]).toMatchObject({ type: "strikethrough" });
  });

  it("parses inline code", () => {
    const nodes = parseInline("`code`");
    expect(nodes[0]).toMatchObject({ type: "inlineCode", value: "code" });
  });

  it("parses a link", () => {
    const nodes = parseInline("[text](https://example.com)");
    expect(nodes[0]).toMatchObject({
      type: "link",
      href: "https://example.com",
    });
  });

  it("parses a link with a title", () => {
    const nodes = parseInline('[text](https://example.com "Title")');
    expect(nodes[0]).toMatchObject({
      type: "link",
      href: "https://example.com",
      title: "Title",
    });
  });

  it("parses an image", () => {
    const nodes = parseInline("![alt](https://example.com/img.png)");
    expect(nodes[0]).toMatchObject({
      type: "image",
      alt: "alt",
      src: "https://example.com/img.png",
    });
  });

  it("parses bold inside a link", () => {
    const nodes = parseInline("[**bold link**](https://example.com)");
    const link = nodes[0] as { type: string; children: { type: string }[] };
    expect(link.type).toBe("link");
    expect(link.children[0].type).toBe("bold");
  });

  it("does not treat a lone * as italic", () => {
    const nodes = parseInline("3 * 4 = 12");
    expect(nodes[0]).toMatchObject({ type: "text" });
  });

  it("emits a soft break for a newline inside a paragraph", () => {
    const nodes = parseInline("line one\nline two");
    const types = nodes.map((n) => (n as { type: string }).type);
    expect(types).toContain("softBreak");
  });

  it("emits a line break for two trailing spaces", () => {
    const nodes = parseInline("text  \nmore");
    const types = nodes.map((n) => (n as { type: string }).type);
    expect(types).toContain("lineBreak");
  });
});
