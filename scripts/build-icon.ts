// Renders docs/public/logo.svg into the electron-builder application icon at
// build/icon.png (default build-resources path; electron-builder converts it
// to .icns/.ico for the mac/win targets).
//
// The SVG's inner strokes carry vector-effect="non-scaling-stroke", which
// keeps them at ~4 screen pixels regardless of raster size and nearly erases
// them at icon sizes; it is stripped here so strokes scale with the image.
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {Resvg} from "@resvg/resvg-js";

const root = path.resolve(import.meta.dirname, "..");
const size = 1024;

function main(): void {
  const svg = readFileSync(path.join(root, "docs", "public", "logo.svg"), "utf8")
    .replaceAll(" vector-effect=\"non-scaling-stroke\"", "");
  const png = new Resvg(svg, {fitTo: {mode: "width", value: size}}).render().asPng();
  mkdirSync(path.join(root, "build"), {recursive: true});
  writeFileSync(path.join(root, "build", "icon.png"), png);
  console.log("build/icon.png rendered");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
