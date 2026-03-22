import fs from "fs";
import path from "path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const iconsDir = path.resolve(scriptDir, "../assets/icons");
const outFile = path.resolve(scriptDir, "../client/src/data/icon-names.json");

const names = fs
  .readdirSync(iconsDir)
  .filter((f) => f.endsWith(".png"))
  .map((f) => f.replace(/\.png$/, ""))
  .sort();

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(names));

console.log(`Generated ${names.length} icon names to ${outFile}`);
