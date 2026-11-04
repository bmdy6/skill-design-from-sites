import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTasteTokens } from "../scripts/taste-check.mjs";
import { buildTokens } from "../scripts/build-tokens.mjs";
import { inputs } from "./helpers/tokens.mjs";
test("straight edge taste rejects round tokens and references determine structural source", () => {
  const { evidence, labels } = inputs(),
    taste = {
      axes: { radiusPx: { range: [0, 4], strength: -1 } },
      references: [
        { role: "primary", url: evidence[1].url },
        { role: "color", url: evidence[0].url },
        { role: "type", url: evidence[2].url },
      ],
      rules: [],
    };
  const r = buildTokens(evidence, labels, {}, { taste });
  assert.equal(r.report.primarySite, "b");
  assert.equal(r.sources["fontFamily.body"].site, "c");
  assert.equal(r.report.tasteCheck.ok, false);
  assert.equal(
    checkTasteTokens(taste, r.tokens).violations[0].axis,
    "radiusPx",
  );
});

import { tasteCheck } from "../scripts/taste-check.mjs";
import { checkAxes } from "../scripts/lib/taste-check.mjs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
test("weak preferences return insufficient evidence and a nonzero CLI exit", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-weak-taste-"));
  try {
    const file = path.join(dir, "taste.json");
    await fs.writeFile(
      file,
      JSON.stringify({ axes: { radiusPx: { range: [0, 4], strength: 0.4 } } }),
    );
    const result = await tasteCheck({ taste: file });
    assert.equal(result.ok, false);
    assert.equal(result.status, "insufficient");
    assert.equal(result.score, null);
    const cli = spawnSync(
      process.execPath,
      ["scripts/taste-check.mjs", "--taste", file],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 1, cli.stderr);
    assert.equal(JSON.parse(cli.stdout).status, "insufficient");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("missing token fields return insufficient evidence instead of a perfect score", () => {
  const result = checkTasteTokens(
    { axes: { radiusPx: { range: [0, 4], strength: 1 } } },
    {},
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, "insufficient");
  assert.equal(result.score, null);
  assert.deepEqual(result.unchecked, ["radiusPx"]);
});
test("avoid axes reject inclusive boundaries and accept values outside the interval", () => {
  const taste = {
    axes: { "motion.animations": { avoid: [8, 12], strength: -1 } },
  };
  for (const animations of [8, 10, 12]) {
    const result = checkAxes(taste, { motion: { animations } }, "fixture");
    assert.equal(result.ok, false);
    assert.equal(result.violations[0].axis, "motion.animations");
    assert.deepEqual(result.violations[0].expected, [8, 12]);
  }
  for (const animations of [0, 7, 13])
    assert.equal(checkAxes(taste, { motion: { animations } }).ok, true);
});
