import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parse } from "path";

const ICONS_DIR = resolve(import.meta.dirname ?? __dirname, "../src/assets/icons");
const OUTPUT = resolve(import.meta.dirname ?? __dirname, "../public/sprite.svg");

const ID_ATTRIBUTE = /[-\w]+(?==['"])/g;

function iconName(file: string): string {
  return file.replace(/\.svg$/i, "");
}

function stripSvgRoot(svg: string): string {
  return svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
}

function generate(): void {
  if (!existsSync(ICONS_DIR)) {
    console.error(`❌ Icons directory not found: ${ICONS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(ICONS_DIR).filter((f) => f.endsWith(".svg"));

  if (files.length === 0) {
    console.warn("⚠️  No SVG files found in src/assets/icons/");
    writeFileSync(
      OUTPUT,
      `<svg xmlns="http://www.w3.org/2000/svg" style="display:none"></svg>`,
      "utf-8",
    );
    return;
  }

  const symbols = files
    .map((file) => {
      const name = iconName(file);
      const content = readFileSync(join(ICONS_DIR, file), "utf-8");
      const inner = stripSvgRoot(content);
      const viewBox = content.match(/viewBox=["']([^"']*)["']/)?.[1] ?? "0 0 24 24";
      return `  <symbol id="${name}" viewBox="${viewBox}">\n${inner}\n  </symbol>`;
    })
    .join("\n");

  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols}\n</svg>`;
  writeFileSync(OUTPUT, sprite, "utf-8");
  console.log(`✅ Sprite generated: ${OUTPUT} (${files.length} icons)`);
}

generate();
