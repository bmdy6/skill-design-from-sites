import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifyDeclaration,
  sampleSources,
  verifySources,
} from "../scripts/verify-sources.mjs";
import { serve } from "./helpers/serve.mjs";
import { collect } from "../scripts/collect.mjs";
import { extractRaw } from "../scripts/extract.mjs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeJSON } from "../scripts/lib/io.mjs";
test("source checks bind authored value to exact line, with repeatable sampling", () => {
  assert.equal(
    verifyDeclaration("a {\n  color: #123456;\n}\n", 2, 3, "#123456"),
    true,
  );
  assert.equal(
    verifyDeclaration("a {\n  color: #123456;\n}\n", 1, 3, "#123456"),
    false,
  );
  const sources = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [
      "color." + i,
      {
        evidence: [{ selector: "#x" + i, line: 1, stylesheet: "fixture.css" }],
      },
    ]),
  );
  assert.deepEqual(
    sampleSources(sources, 10, 1),
    sampleSources(sources, 10, 1),
  );
  assert.equal(sampleSources(sources, 10, 1).length, 10);
});
test("ten local CDP declarations reverify and corrupt line fails", async () => {
  const server = await serve("test/fixtures");
  const run = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-verify-"));
  try {
    const raws = await collect({
      url: server.url + "/site-a/",
      "site-id": "a",
      out: run,
    });
    const e = extractRaw(raws),
      sources = {};
    for (const [sid, s] of Object.entries(e.samples))
      if (s.line && s.stylesheet.endsWith("main.css"))
        sources[sid] = { evidence: [s] };
    await writeJSON(path.join(run, "sources.json"), sources);
    const r = await verifySources({ run, sample: 10, seed: 1 });
    assert.equal(r.passed, 10);
    const selected = sampleSources(sources, 10, 1)[0];
    sources[selected.token].evidence[0].line += 1000;
    await writeJSON(path.join(run, "sources.json"), sources);
    const bad = await verifySources({ run, sample: 10, seed: 1 });
    assert.ok(bad.failures.length);
  } finally {
    await server.close();
    await fs.rm(run, { recursive: true, force: true });
  }
});
