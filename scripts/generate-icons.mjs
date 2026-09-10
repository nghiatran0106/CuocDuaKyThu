import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Uses librsvg's existing rsvg-convert command; no game dependencies are needed.
// Run from any directory with: node scripts/generate-icons.mjs
const icons = new URL("../public/icons/", import.meta.url);
const exports = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["maskable.svg", "maskable-512.png", 512],
  ["icon.svg", "apple-touch-icon.png", 180],
];

for (const [source, filename, size] of exports) {
  const result = spawnSync(
    "rsvg-convert",
    [
      "--width",
      String(size),
      "--height",
      String(size),
      "--output",
      fileURLToPath(new URL(filename, icons)),
      fileURLToPath(new URL(source, icons)),
    ],
    { encoding: "utf8" },
  );
  if (result.error || result.status !== 0) {
    console.error(
      result.error?.code === "ENOENT"
        ? "Install librsvg's rsvg-convert command to regenerate the committed icons."
        : result.error?.message || result.stderr,
    );
    process.exit(1);
  }
  console.log(`${filename}: ${size} × ${size}`);
}
