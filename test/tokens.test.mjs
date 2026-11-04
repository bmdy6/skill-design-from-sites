import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTokens, flattenTokens } from "../scripts/build-tokens.mjs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readJSON, writeJSON } from "../scripts/lib/io.mjs";
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

for (const [name, axes, insufficient, violation] of [
  ["empty axes", {}, true, false],
  ["weak preferences", { radiusPx: { range: [0, 4], strength: 0.4 } }, true, false],
  ["missing fields", { "motion.animations": { range: [0, 4], strength: 1 } }, true, false],
  ["real violations", { theme: { prefer: "dark", strength: 1 } }, false, true],
  ["matching preferences", { theme: { prefer: "light", strength: 1 } }, false, false],
])
  test(`tokens build CLI handles ${name} without confusing insufficient evidence with violations`, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-token-taste-"));
    try {
      const { evidence, labels } = inputs();
      for (const e of evidence)
        await writeJSON(path.join(dir, "evidence", e.siteId + ".json"), e);
      for (const l of labels)
        await writeJSON(path.join(dir, "labels", l.siteId + ".json"), l);
      await writeJSON(path.join(dir, "taste.json"), { axes });
      const cli = spawnSync(process.execPath, [
        "scripts/build-tokens.mjs",
        "--evidence", path.join(dir, "evidence"),
        "--labels", path.join(dir, "labels"),
        "--taste", path.join(dir, "taste.json"),
        "--out", dir,
      ], { encoding: "utf8" });
      assert.equal(cli.status, violation ? 1 : 0, cli.stderr);
      assert.equal(JSON.parse(cli.stdout).ok, !violation);
      const report = await readJSON(path.join(dir, "merge-report.json"));
      assert.equal(report.tasteCheck.violations.length > 0, violation);
      if (insufficient) {
        assert.match(cli.stderr, /warning.*insufficient.*evidence/i);
        assert.equal(report.tasteCheck.status, "insufficient");
        assert.equal(report.tasteCheck.ok, false);
        assert.equal(report.tasteCheck.score, null);
      } else {
        assert.doesNotMatch(cli.stderr, /insufficient/i);
      }
      await fs.access(path.join(dir, "tokens.json"));
      await fs.access(path.join(dir, "sources.json"));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
