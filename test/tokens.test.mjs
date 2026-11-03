import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTokens, flattenTokens } from "../scripts/build-tokens.mjs";
import { inputs } from "./helpers/tokens.mjs";
import { contrast } from "../scripts/lib/color.mjs";
import StyleDictionary from "style-dictionary";
test("token merge uses one structural source, complete provenance, and derived contrast corrections", async () => {
  const { evidence, labels } = inputs();
  const r = buildTokens(evidence, labels);
  assert.equal(r.report.primarySite, "a");
  for (const [p, t] of Object.entries(flattenTokens(r.tokens))) {
    const s = r.sources[p];
    assert.ok(s);
    if (p.startsWith("shadow.")) {
      assert.equal(t.$value.offsetY.value, 4);
      assert.equal(t.$value.blur.value, 16);
      continue;
    }
    if (!s.derived)
      assert.ok(
        evidence
          .find((e) => e.siteId === s.site)
          .clusters[p.split(".")[0]].some(
            (c) =>
              c.px === t.$value?.value ||
              c.value === t.$value ||
              Number(c.value) === t.$value,
          ),
      );
    if (["spacing", "fontSize", "radius"].includes(p.split(".")[0]))
      assert.equal(s.site, "a");
  }
  assert.ok(r.report.contrastFixes.length);
  assert.ok(
    contrast(
      r.tokens.color["text-muted"].$value,
      r.tokens.color.surface.$value,
    ) >= 4.5,
  );
  assert.equal(
    buildTokens(evidence, labels, { fontFamily: "b" }).sources[
      "fontFamily.body"
    ].site,
    "b",
  );
  const sd = new StyleDictionary(
    { tokens: r.tokens, platforms: { css: { transformGroup: "css" } } },
    { verbosity: "silent" },
  );
  await sd.getPlatformTokens("css");
});
test("label IDs cannot invent values", () => {
  const { evidence, labels } = inputs();
  labels[0].color.primary = "missing";
  assert.throws(
    () => buildTokens(evidence, labels),
    (e) => e.exitCode === 2,
  );
});
