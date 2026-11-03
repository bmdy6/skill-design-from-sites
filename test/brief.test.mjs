import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBrief } from "../scripts/lib/brief.mjs";
const brief = {
  schemaVersion: 1,
  owner: "self",
  goal: "A focused planner",
  pageTypes: ["landing"],
  references: [],
  likeWords: ["calm"],
  avoidWords: [],
  constraints: { theme: "any", brandColor: null },
  needInspire: true,
};
test("brief validates inspiration branch and rejects a dead-end intake", () => {
  assert.deepEqual(validateBrief(brief), brief);
  assert.throws(
    () => validateBrief({ ...brief, needInspire: false }),
    (e) => e.exitCode === 2,
  );
  assert.throws(
    () => validateBrief({ ...brief, owner: "unknown" }),
    (e) => e.exitCode === 2,
  );
  assert.equal(
    validateBrief({
      ...brief,
      needInspire: false,
      references: [{ url: "https://example.org", note: "Structure" }],
    }).needInspire,
    false,
  );
});
