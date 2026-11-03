import { test } from "node:test";
import assert from "node:assert/strict";
import { baselineFromCode } from "../scripts/baseline-from-code.mjs";
import { consistencyCheck } from "../scripts/consistency-check.mjs";
import { buildTokens } from "../scripts/build-tokens.mjs";
import { inputs } from "./helpers/tokens.mjs";
test("local code baseline reads CSS, static config and DTCG with exact source lines", async () => {
  const e = await baselineFromCode({ dir: "test/fixtures/baseline" });
  assert.equal(e.siteId, "baseline");
  const blue = e.clusters.color.find((c) => c.value === "#2563eb");
  assert.ok(blue);
  const s = e.samples[blue.sampleRefs[0]];
  assert.equal(s.line, 2);
  assert.equal(s.column, 3);
  assert.ok(e.clusters.color.some((c) => c.value === "#a44321"));
  assert.ok(e.clusters.spacing.some((c) => c.px === 24));
  assert.ok(e.clusters.fontSize.some((c) => c.px === 14));
});
test("new values require exact value approval; company external structure is rejected", () => {
  const baseline = {
      color: { primary: { $type: "color", $value: "#2563eb" } },
    },
    tokens = { color: { primary: { $type: "color", $value: "#ff0000" } } };
  assert.equal(consistencyCheck(baseline, tokens).ok, false);
  assert.equal(
    consistencyCheck(baseline, tokens, [
      { token: "color.primary", value: "#ff0000" },
    ]).ok,
    true,
  );
  assert.equal(
    consistencyCheck(baseline, tokens, [
      { token: "color.primary", value: "#00ff00" },
    ]).ok,
    false,
  );
  const { evidence, labels } = inputs();
  evidence[0].siteId = "baseline";
  labels[0].siteId = "baseline";
  const company = { existingPages: evidence[0].url, allowedChanges: ["color"] };
  assert.throws(
    () =>
      buildTokens(
        evidence,
        labels,
        {},
        {
          company,
          taste: {
            axes: {},
            references: [{ role: "primary", url: evidence[1].url }],
          },
        },
      ),
    (e) => e.exitCode === 2,
  );
  assert.throws(
    () => buildTokens(evidence, labels, { fontFamily: "b" }, { company }),
    (e) => e.exitCode === 2,
  );
  assert.equal(
    buildTokens(evidence, labels, {}, { company }).report.primarySite,
    "baseline",
  );
});
test("accent-only company permission keeps neutral colors at baseline without mutating evidence", () => {
  const { evidence, labels } = inputs();
  evidence[0].siteId = "baseline";
  labels[0].siteId = "baseline";
  const before = JSON.stringify(evidence);
  const r = buildTokens(
    evidence,
    labels,
    { color: "b" },
    { company: { allowedChanges: ["color.brand"] } },
  );
  assert.equal(r.sources["color.primary"].site, "b");
  assert.equal(r.sources["color.surface"].site, "baseline");
  assert.equal(JSON.stringify(evidence), before);
});
