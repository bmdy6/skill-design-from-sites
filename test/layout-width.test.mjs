import { test } from "node:test";
import assert from "node:assert/strict";
import { extractRaw } from "../scripts/extract.mjs";
import { rawFixture } from "./helpers/raw.mjs";
import { buildTokens } from "../scripts/build-tokens.mjs";
import { inputs } from "./helpers/tokens.mjs";
test("layout widths retain evidence and always use the structural primary", () => {
  const raw = rawFixture(),
    eid = raw.elements.length;
  raw.elements.push({
    eid,
    tag: "main",
    role: "",
    selector: "main",
    bbox: [0, 0, 960, 800],
    textLen: 0,
    hasBgImage: false,
    styles: { "max-width": "960px" },
  });
  raw.decls.push({
    key: "max-width|960px",
    count: 1,
    area: 768000,
    samples: [
      {
        sid: "width-source",
        eid,
        origin: "regular",
        ruleSelector: "main",
        authoredValue: "960px",
        stylesheet: "fixture.css",
        line: 8,
        column: 1,
      },
    ],
  });
  const e = extractRaw([raw]);
  assert.equal(e.clusters.maxWidth[0].px, 960);
  const { evidence, labels } = inputs();
  evidence[0] = e;
  const result = buildTokens(evidence, labels);
  assert.equal(result.tokens.maxWidth["1"].$value.value, 960);
  assert.equal(result.sources["maxWidth.1"].site, "a");
  assert.equal(result.sources["maxWidth.1"].evidence[0].selector, "main");
});
