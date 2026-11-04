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

import { checkAxes } from "../scripts/lib/taste-check.mjs";
test("three motion-only dislikes preserve avoid quantiles alongside positive preferences", () => {
  const { captures, votes } = tasteInputs();
  votes.items.forEach((v) => {
    v.aspects = ["color", "layout"];
  });
  for (const [i, animations] of [8, 10, 12].entries()) {
    captures.captures.push({
      cid: `motion${i}`,
      fp: { motion: { animations, keyframes: animations } },
    });
    votes.items.push({
      cid: `motion${i}`,
      vote: "dislike",
      aspects: ["motion"],
    });
  }
  const taste = tasteBuild(captures, votes);
  assert.deepEqual(taste.axes["motion.animations"]?.avoid, [8.4, 11.6]);
  assert.ok(taste.axes["motion.animations"].strength <= -0.5);
  assert.deepEqual(taste.axes["motion.keyframes"].avoid, [8.4, 11.6]);
  assert.equal(taste.axes.theme.prefer, "dark");
  assert.equal(
    checkAxes(taste, { motion: { animations: 10, keyframes: 10 } }).ok,
    false,
  );
  assert.equal(
    checkAxes(taste, { motion: { animations: 0, keyframes: 0 } }).ok,
    true,
  );
});
test("color-only dislikes do not invent a preferred theme or lose the negative axis", () => {
  const { captures, votes } = tasteInputs();
  const taste = tasteBuild(captures, {
    items: votes.items.filter((v) => v.vote === "dislike"),
  });
  assert.deepEqual(taste.axes.bgL?.avoid, [0.95, 0.95]);
  assert.equal(taste.axes.theme, undefined);
});
