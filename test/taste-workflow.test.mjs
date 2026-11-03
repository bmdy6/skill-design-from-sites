import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "../scripts/run.mjs";
import { writeJSON, readJSON } from "../scripts/lib/io.mjs";
import { tasteInputs } from "./helpers/taste.mjs";
test("reference and discovery branches persist actionable next steps and taste approval", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-taste-flow-"));
  try {
    const brief = {
      schemaVersion: 1,
      mode: "personal",
      owner: "self",
      goal: "Planner",
      pageTypes: ["landing"],
      references: [{ url: "https://fixture.invalid", note: "Layout" }],
      likeWords: [],
      avoidWords: [],
      constraints: { theme: "any", brandColor: null },
      needInspire: false,
    };
    await writeJSON(path.join(dir, "brief.json"), brief);
    const next = await run({ _: ["taste"], out: dir });
    assert.equal(next.step, "capture");
    assert.equal(
      (await readJSON(path.join(dir, "inspire/candidates.json"))).candidates
        .length,
      1,
    );
    const { captures, votes } = tasteInputs();
    await writeJSON(path.join(dir, "inspire/captures.json"), captures);
    await writeJSON(path.join(dir, "inspire/votes.json"), votes);
    const ready = await run({ _: ["taste"], phase: "build", out: dir });
    assert.equal(ready.gate, "user");
    assert.equal(ready.step, "taste");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
