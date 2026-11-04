import { test } from "node:test";
import assert from "node:assert/strict";
import { extractRaw } from "../scripts/extract.mjs";
import { rawFixture } from "./helpers/raw.mjs";
import { validate } from "../scripts/lib/schema.mjs";
test("extract clusters original colors, composites alpha, rejects type outlier and is deterministic", () => {
  const raw = rawFixture();
  const e = extractRaw([raw]);
  validate("evidence", e);
  assert.equal(
    e.clusters.fontSize.find((c) => c.id === e.autoNames.fontSize.base).px,
    16,
  );
  assert.deepEqual(e, extractRaw([raw]));
  const c = e.clusters.color.find((c) => c.members.includes("#2563eb"));
  assert.ok(c.members.includes("#2564eb"));
  assert.ok(c.members.includes(c.value));
  assert.ok(e.clusters.color.some((c) => c.composite && c.value === "#808080"));
  assert.ok(e.outliers.some((o) => o.value === "13px"));
  for (const clusters of Object.values(e.clusters))
    for (const c of clusters) assert.ok(c.sampleRefs.length > 0);
});
test("8px and 1.2 scales are inferred from synthetic measurements", () => {
  const e = extractRaw([rawFixture("b")]);
  assert.equal(e.scales.spacingBase, 8);
  assert.ok(Math.abs(e.scales.typeRatio - 1.2) < 0.02);
});

import { color } from "../scripts/lib/color.mjs";
test("non-color blur syntax returns null without throwing", () => {
  assert.equal(color("blur(8px)"), null);
});
test("extract ignores custom properties containing color in the middle", () => {
  const raw = rawFixture();
  raw.decls.push({
    ...structuredClone(raw.decls[0]),
    key: "--color-x|#ff00ff",
  });
  const result = extractRaw([raw]);
  assert.equal(
    result.clusters.color.some((c) => c.value === "#ff00ff"),
    false,
  );
});
test("extract survives blur-valued CSS variables while preserving real colors", () => {
  const raw = rawFixture();
  raw.cssVars.unshift({
    name: "--color-x",
    value: "blur(8px)",
    scope: ":root",
    source: {},
  });
  raw.decls.push({
    ...structuredClone(raw.decls[0]),
    key: "--color-x|blur(8px)",
  });
  assert.ok(
    extractRaw([raw]).clusters.color.some((c) => c.value === "#2563eb"),
  );
});
