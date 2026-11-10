import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFragment } from "../scripts/revise-apply.mjs";
const original = '<main><section data-ds-id="target">Old</section><aside>Untouched</aside></main>';
const tokens = { spacing: { base: { $type: "dimension", $value: { value: 16, unit: "px" } } } };

test("applyFragment rejects literal var fallbacks with exit 1", () => {
  for (const style of ["padding:var(--does-not-exist,99px)", "color:var(--c,#ff0000)", "padding:var(--a,var(--b,99px))"])
    assert.throws(() => applyFragment(original, "target",
      `<section data-ds-id="target" style="${style}">New</section>`, tokens),
    (e) => e.exitCode === 1 && /hardcoded/.test(e.message));
});

test("applyFragment accepts token fallbacks and keeps outside nodes intact", () => {
  const result = applyFragment(original, "target",
    '<section data-ds-id="target" style="padding:var(--missing,var(--spacing-base))">New</section>', tokens);
  assert.equal(result.hashCheck, true);
  assert.deepEqual(result.findings, []);
  assert.match(result.html, /<aside>Untouched<\/aside>/);
});
