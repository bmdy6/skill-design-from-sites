import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { readJSON } from "../scripts/lib/io.mjs";
test("handwritten source expectations point at declarations", async () => {
  for (const id of ["a", "b", "c"]) {
    const ex = await readJSON(`test/fixtures/expected/site-${id}.json`);
    const css = await fs.readFile(`test/fixtures/site-${id}/main.css`, "utf8");
    assert.ok(
      css.split("\n")[ex.button.line - 1].includes(ex.button.authoredValue),
    );
    assert.equal(ex.button.column, 3);
  }
});
