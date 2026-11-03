import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { checkPaths, checkText } from "../scripts/check.mjs";
import { inputs } from "./helpers/tokens.mjs";
import { buildTokens } from "../scripts/build-tokens.mjs";
import { readJSON } from "../scripts/lib/io.mjs";
test("CSS, HTML, JSX and arbitrary values produce exact source findings", async () => {
  const { evidence, labels } = inputs(),
    tokens = buildTokens(evidence, labels).tokens;
  const r = await checkPaths(["test/fixtures/code-bad"], tokens);
  assert.deepEqual(
    r.findings.map((f) => path.basename(f.file) + ":" + f.line).sort(),
    (await readJSON("test/fixtures/expected/findings.json")).sort(),
  );
  const blue = r.findings.find((f) => f.value === "#2564ea");
  assert.equal(blue.nearestToken, "color.primary");
  assert.ok(blue.delta.deltaE < 1);
  assert.equal(
    (await checkPaths(["test/fixtures/code-good"], tokens)).summary.findings,
    0,
  );
  assert.equal(
    checkText("a { color:#123456; }", "x.css", tokens, [
      { file: "x.css", line: 1, property: "color" },
    ]).length,
    0,
  );
});
test("named colors, border shorthands and concealed custom values are checked", () => {
  const tokens = { color: { primary: { $type: "color", $value: "#ff0000" } } };
  assert.equal(
    checkText(
      "a{color:red;border:1px solid blue;--hidden:#123456}",
      "x.css",
      tokens,
    ).length,
    3,
  );
  assert.equal(
    checkText(":root{--color-primary:#ff0000}", "tokens.css", tokens).length,
    0,
  );
  assert.equal(
    checkText(":root{--color-primary:#0000ff}", "tokens.css", tokens).length,
    1,
  );
});
