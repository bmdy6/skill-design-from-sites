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

const dimensions = {
  spacing: { base: { $type: "dimension", $value: { value: 16, unit: "px" } } },
};
test("JSX numeric lengths are checked as px, like their string equivalents", () => {
  const numeric = checkText('<div style={{padding:24,margin:12,borderRadius:8}} />', "x.jsx", dimensions);
  const strings = checkText('<div style={{padding:"24px",margin:"12px",borderRadius:"8px"}} />', "x.jsx", dimensions);
  assert.equal(numeric.length, 3);
  assert.deepEqual(numeric.map((f) => [f.property, f.kind, f.nearestToken, f.delta]),
    strings.map((f) => [f.property, f.kind, f.nearestToken, f.delta]));
  assert.deepEqual(numeric.map((f) => f.value), ["24", "12", "8"]);
});

test("JSX numeric lengths retain source positions, zero exemptions and allowlists", () => {
  const text = '<div style={{\n  padding: -2.5,\n  margin: 0,\n  width: 12,\n  gap: 3 // dfs-ignore\n}} />';
  const findings = checkText(text, "x.tsx", dimensions, [{ file: "x.tsx", line: 4, property: "width" }]);
  assert.equal(findings.length, 1);
  assert.deepEqual([findings[0].line, findings[0].column, findings[0].value], [2, 3, "-2.5"]);
});

test("unitless JSX properties and CSS numbers remain legal", () => {
  const values = 'opacity:0.5,zIndex:10,flex:1,flexGrow:1,flexShrink:0,lineHeight:1.5,fontWeight:700,order:2,scale:2,animationIterationCount:3,strokeWidth:2,fillOpacity:0.5';
  assert.deepEqual(checkText(`<div style={{${values},padding:0,margin:0,borderRadius:0}} />`, "x.jsx", dimensions), []);
  assert.deepEqual(checkText('a{opacity:.5;z-index:10;flex:1;line-height:1.5;font-weight:700;padding:0}', "x.css", dimensions), []);
});

test("CSS var fallbacks expose literal lengths and colors", () => {
  const text = 'a{padding:var(--does-not-exist,99px);color:var(--does-not-exist,#ff0000)}';
  const findings = checkText(text, "x.css", dimensions);
  assert.deepEqual(findings.map((f) => f.property), ["padding", "color"]);
  assert.equal(findings[0].nearestToken, "spacing.base");
  assert.deepEqual(findings[0].delta, { px: 83 });
});

for (const [value, count] of [
  ["var(--spacing-base)", 0],
  ["var(--missing, var(--spacing-base))", 0],
  ["var(--missing, 0)", 0],
  ["var(--missing, inherit)", 0],
  ["var(--missing, 16px)", 1], // Equal to a token is still a literal.
  ["var(--missing, var(--other, 99px))", 1],
  ["var(--missing, calc(var(--spacing-base) + 99px))", 1],
  ["var(--missing, calc(var(--spacing-base) * 2))", 0],
  ["var(--a) var(--b, 99px)", 1],
  ["VAR(--missing, 99px)", 1],
])
  test(`fallback ${value} has ${count} finding(s)`, () => {
    assert.equal(checkText(`a{padding:${value}}`, "x.css", dimensions).length, count);
  });

test("functional color fallbacks and nested token references work in HTML and JSX", () => {
  for (const file of ["x.css", "x.html", "x.jsx"])
    for (const value of ["var(--c,rgb(255,0,0))", "var(--c,hsl(0,100%,50%))", "var(--c,red)"]) {
      const text = file.endsWith("css") ? `a{color:${value}}`
        : file.endsWith("html") ? `<div style="color:${value}"></div>`
        : `<div style={{color:"${value}"}} />`;
      assert.equal(checkText(text, file, dimensions).length, 1, text);
    }
  assert.deepEqual(checkText('<div style={{padding:"var(--a, var(--spacing-base))",color:"var(--a, var(--color-primary))"}} />', "x.jsx", dimensions), []);
});

test("fractional and exponent JSX numbers use px while numeric zeros stay exempt", () => {
  const findings = checkText('<div style={{padding:.5,margin:-2.5,gap:1e2,width:+24,borderRadius:-0.0}} />', "x.jsx", dimensions);
  assert.deepEqual(findings.map((f) => [f.property, f.value]),
    [["padding", ".5"], ["margin", "-2.5"], ["gap", "1e2"], ["width", "+24"]]);
  assert.deepEqual(findings[2].delta, { px: 84 });
});
