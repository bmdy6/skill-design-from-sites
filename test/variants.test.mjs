import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { variantHTML, variants } from "../scripts/preview-variants.mjs";
import { checkText } from "../scripts/check.mjs";
import { buildTokens } from "../scripts/build-tokens.mjs";
import { inputs } from "./helpers/tokens.mjs";
import { writeJSON, readJSON } from "../scripts/lib/io.mjs";
test("three draft layouts use tokens without hardcoded values", () => {
  const { evidence, labels } = inputs(),
    tokens = buildTokens(evidence, labels).tokens;
  const layouts = ["centered", "split", "editorial"];
  const htmls = layouts.map((l) => variantHTML(tokens, l));
  assert.equal(new Set(htmls).size, 3);
  for (const html of htmls)
    assert.equal(checkText(html, "variant.html", tokens).length, 0);
});
test("high fidelity is blocked until a variant is explicitly picked", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-variants-"));
  try {
    await writeJSON(path.join(dir, "variants.json"), {
      wire: { approved: true },
      variants: [],
      picked: null,
      hifi: { file: null, approved: false },
    });
    await assert.rejects(
      () => variants({ run: dir, stage: "hifi" }),
      (e) => e.exitCode === 3,
    );
    assert.equal((await readJSON(path.join(dir, "next.json"))).gate, "user");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
