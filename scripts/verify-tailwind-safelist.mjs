import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const requiredUtilities = [
  "bg-lime",
  "bg-sky",
  "bg-lavender",
  "bg-peach",
  "text-green-700",
  "text-yellow-700",
  "text-red-700",
  "bg-destructive",
  "bg-orange-500",
  "bg-green-600",
  "bg-transparent",
  "text-destructive",
  "text-orange-600",
];
const maxCssBytes = 1_000_000;
const assetsDirectory = path.resolve("dist", "assets");

const cssFiles = (await readdir(assetsDirectory)).filter((file) => file.endsWith(".css"));

if (cssFiles.length === 0) {
  throw new Error("No generated CSS files were found in dist/assets.");
}

const cssPaths = cssFiles.map((file) => path.join(assetsDirectory, file));
const cssContents = await Promise.all(cssPaths.map((file) => readFile(file, "utf8")));
const cssSize = (await Promise.all(cssPaths.map((file) => stat(file)))).reduce(
  (total, file) => total + file.size,
  0,
);
const generatedCss = cssContents.join("\n");
const missingUtilities = requiredUtilities.filter(
  (utility) => !generatedCss.includes(`.${utility}`),
);

if (missingUtilities.length > 0) {
  throw new Error(`Missing safelisted Tailwind utilities: ${missingUtilities.join(", ")}`);
}

if (cssSize > maxCssBytes) {
  throw new Error(
    `Generated CSS is ${(cssSize / 1024 / 1024).toFixed(2)} MB, exceeding the 1 MB guardrail.`,
  );
}

console.log(
  `Verified ${requiredUtilities.length} safelisted utilities in ${(cssSize / 1024).toFixed(1)} KB of CSS.`,
);
