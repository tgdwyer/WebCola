/*
 * tsdx emits the ES module bundle as `dist/<name>.esm.js`. Because webcola's
 * package.json has no `"type": "module"`, Node (and some bundlers) parse such a
 * file as CommonJS, so `import ... from "webcola"` fails with a syntax error.
 *
 * This task renames the bundle to `dist/<name>.esm.mjs`, which is unambiguously
 * an ES module (and which Node also honours explicitly through the "exports"
 * map in package.json), and repoints the trailing sourceMappingURL comment.
 */
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const name = process.argv[2] || "cola";

const esm = path.join(distDir, `${name}.esm.js`);
const mjs = path.join(distDir, `${name}.esm.mjs`);
const map = path.join(distDir, `${name}.esm.js.map`);
const mjsMap = path.join(distDir, `${name}.esm.mjs.map`);

if (!fs.existsSync(esm)) {
  console.error(`[esm] expected bundle not found: ${esm}`);
  process.exit(1);
}

const bundle = fs
  .readFileSync(esm, "utf8")
  .replace(`//# sourceMappingURL=${name}.esm.js.map`, `//# sourceMappingURL=${name}.esm.mjs.map`);

if (!bundle.includes(`sourceMappingURL=${name}.esm.mjs.map`)) {
  console.error(`[esm] sourceMappingURL not found in ${esm}`);
  process.exit(1);
}

fs.writeFileSync(mjs, bundle);

if (fs.existsSync(map)) {
  const sourceMap = JSON.parse(fs.readFileSync(map, "utf8"));
  sourceMap.file = `${name}.esm.mjs`;
  fs.writeFileSync(mjsMap, JSON.stringify(sourceMap));
}

fs.unlinkSync(esm);
if (fs.existsSync(map)) fs.unlinkSync(map);

console.log(`[esm] wrote ${path.relative(process.cwd(), mjs)}`);
