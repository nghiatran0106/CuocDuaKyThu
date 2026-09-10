import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist");
async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return children.flat();
}
const files = (await listFiles(output))
  .map((file) => relative(output, file).split(sep).join("/"))
  .filter((file) => file !== "sw.js")
  .sort();
for (const required of [
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
])
  if (!files.includes(required))
    throw new Error(`Missing app asset: ${required}`);

const template = await readFile(
  new URL("service-worker.js", import.meta.url),
  "utf8",
);
const hash = createHash("sha256").update(template);
let bytes = 0;
for (const file of files) {
  const contents = await readFile(resolve(output, file));
  hash.update(file).update(contents);
  bytes += contents.byteLength;
}
const version = hash.digest("hex").slice(0, 16);
const worker = template
  .replace("__BUILD_VERSION__", JSON.stringify(version))
  .replace("__PRECACHE_FILES__", JSON.stringify(files));
await writeFile(resolve(output, "sw.js"), worker);
console.log(
  `PWA ${version}: ${files.length} offline assets, ${(bytes / 1024).toFixed(0)} KiB.`,
);
