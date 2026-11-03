import { test } from "node:test";
import assert from "node:assert/strict";
import { tasteBuild, validateRules } from "../scripts/taste-build.mjs";
import { tasteInputs } from "./helpers/taste.mjs";
test("deterministic preferences identify dark straight edges with evidence-limited rules", () => {
  const { captures, votes } = tasteInputs();
  const t = tasteBuild(captures, votes);
  assert.equal(t.axes.theme.prefer, "dark");
  assert.ok(t.axes.theme.strength >= 0.6);
  assert.ok(t.axes.radiusPx.range[1] <= 4);
  assert.deepEqual(t, tasteBuild(captures, votes));
  assert.equal(
    tasteBuild(captures, { items: votes.items.slice(0, 5) }).confidence,
    "low",
  );
  assert.throws(
    () =>
      validateRules(
        [{ text: "x", axis: "imaginary", evidence: ["k1"] }],
        t,
        votes,
      ),
    (e) => e.exitCode === 2,
  );
  assert.throws(
    () =>
      validateRules(
        [{ text: "x", axis: "theme", evidence: ["k99"] }],
        t,
        votes,
      ),
    (e) => e.exitCode === 2,
  );
});
test("aspect-only color votes do not affect radius", () => {
  const { captures, votes } = tasteInputs();
  votes.items.forEach((v) => (v.aspects = ["color"]));
  const t = tasteBuild(captures, votes);
  assert.equal(t.axes.radiusPx, undefined);
  assert.equal(t.axes.theme.prefer, "dark");
});
