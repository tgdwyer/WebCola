/*
 * Smoke test for the ES module build: it must load in a native ESM context
 * (i.e. Node parses it as a module, not as CommonJS) and expose the public API.
 */
import assert from "assert";
import * as cola from "../dist/cola.esm.mjs";

const expected = [
  "Layout",
  "Layout3D",
  "d3adaptor",
  "Rectangle",
  "Solver",
  "Variable",
  "adaptor",
  "gridify",
  "removeOverlaps",
];

for (const name of expected) {
  assert.ok(name in cola, `missing named export: ${name}`);
}

// A tiny layout run, to prove the module actually works rather than just parsing.
const layout = new cola.Layout();
const nodes = [{ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 100, width: 10, height: 10 }];
layout.nodes(nodes).links([{ source: 0, target: 1 }]).start(1, 10, 1);
for (const node of nodes) {
  assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), "layout produced non-finite coordinates");
}

console.log(`[esm] ${expected.length} named exports verified, layout ran`);
