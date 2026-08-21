import fs from "fs";
import path from "path";

function walk(dir) {
  let r = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory() && f !== "node_modules") r = [...r, ...walk(p)];
    else if (/\.(ts|tsx)$/.test(f)) r.push(p);
  }
  return r;
}

const files = walk("src");
const pkgs = new Set();
for (const f of files) {
  const c = fs.readFileSync(f, "utf8");
  const regex =
    /from\s+['"](@[^/'"]+\/[^/'"]+|[a-z][a-z0-9._-]*)['"]|require\(['"](@[^/'"]+\/[^/'"]+|[a-z][a-z0-9._-]*)['"]\)/g;
  for (const m of c.matchAll(regex)) {
    pkgs.add(m[1] || m[2]);
  }
}

const missing = [];
for (const p of pkgs) {
  if (!fs.existsSync("node_modules/" + p)) {
    missing.push(p);
  }
}

const filtered = missing.filter(
  (p) => !p.startsWith("@/") && !p.startsWith("virtual:") && !p.startsWith("node:"),
);
console.log("Missing packages:", filtered.join("\n"));
