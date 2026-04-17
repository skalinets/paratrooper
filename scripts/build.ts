#!/usr/bin/env bun
import { rm, mkdir, readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const SRC_HTML = "src/index.html";
const minify = !process.argv.includes("--dev");
const hash = minify;

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/main.ts"],
  outdir: DIST,
  minify,
  naming: hash ? "[name]-[hash].[ext]" : "[name].[ext]",
  sourcemap: minify ? "none" : "linked",
  target: "browser",
});

if (!result.success) {
  console.error("build failed");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const jsFile = (await readdir(DIST)).find(
  (f) => f.startsWith("main") && f.endsWith(".js"),
);
if (!jsFile) {
  console.error("main js output not found");
  process.exit(1);
}

let html = await readFile(SRC_HTML, "utf8");
html = html.replace(/src="main\.js"/, `src="${jsFile}"`);

if (minify) {
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*\n\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/\s*([:;{}>,])\s*/g, "$1")
    .trim();
}

await writeFile(join(DIST, "index.html"), html);

if (existsSync("src/_headers")) {
  await copyFile("src/_headers", join(DIST, "_headers"));
}

const jsSize = (await Bun.file(join(DIST, jsFile)).arrayBuffer()).byteLength;
const htmlSize = (await Bun.file(join(DIST, "index.html")).arrayBuffer())
  .byteLength;
console.log(`built ${jsFile} (${(jsSize / 1024).toFixed(1)} KB)`);
console.log(`built index.html (${(htmlSize / 1024).toFixed(2)} KB)`);
