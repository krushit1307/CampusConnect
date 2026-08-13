import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

describe("font CLS optimization (#2393)", () => {
  it("uses metric-matched Space Grotesk fallback descriptors", () => {
    expect(styles).toContain('font-family: "Space Grotesk Fallback";');
    expect(styles).toContain("size-adjust: 93.72%;");
    expect(styles).toContain("ascent-override: 98.4%;");
    expect(styles).toContain("descent-override: 29.2%;");
    expect(styles).toContain("line-gap-override: 0%;");
  });

  it("uses metric-matched Space Mono fallback descriptors", () => {
    expect(styles).toContain('font-family: "Space Mono Fallback";');
    expect(styles).toContain("size-adjust: 99.2%;");
    expect(styles).toContain("ascent-override: 112%;");
    expect(styles).toContain("descent-override: 36.1%;");
  });

  it("routes global typography through shared CSS variables", () => {
    expect(styles).toContain('--font-display: "Space Grotesk", "Space Grotesk Fallback"');
    expect(styles).toContain('--font-mono: "Space Mono", "Space Mono Fallback"');
    expect(styles).toContain("font-family: var(--font-mono);");
    expect(styles).toContain("font-family: var(--font-display);");
  });

  it("preloads both regular and bold critical local fonts", () => {
    expect(index).toContain("/fonts/space-grotesk-latin-400-normal.woff2");
    expect(index).toContain("/fonts/space-grotesk-latin-700-normal.woff2");
    expect(index).toContain("/fonts/space-mono-latin-400-normal.woff2");
    expect(index).toContain("/fonts/space-mono-latin-700-normal.woff2");
  });

  it("does not establish unused Google Fonts connections", () => {
    expect(index).not.toContain('href="https://fonts.googleapis.com"');
    expect(index).not.toContain('href="https://fonts.gstatic.com"');
  });
});
