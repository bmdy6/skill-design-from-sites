import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { variants } from "../scripts/preview-variants.mjs";
import { run } from "../scripts/run.mjs";
import { board } from "../scripts/inspire-board.mjs";
import { approveGate } from "../scripts/lib/gates.mjs";
import { readJSON, writeJSON, write } from "../scripts/lib/io.mjs";

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-selection-gates-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await writeJSON(path.join(dir, "variants.json"), {
    wire: { approved: true },
    variants: [
      { id: "v1", file: "preview/v1.html" },
      { id: "v2", file: "preview/v2.html" },
    ],
    picked: null,
    hifi: { file: null, approved: false },
  });
  await write(path.join(dir, "preview/v1.html"), "<main>First design</main>");
  await write(path.join(dir, "preview/v2.html"), "<main>Different design</main>");
  await variants({ run: dir, stage: "pick", pick: "v1" });
  await approveGate(dir, "variant");
  await variants({ run: dir, stage: "hifi" });
  await approveGate(dir, "hifi");
  assert.equal((await run({ _: ["build"], out: dir })).step, "build");
  return dir;
}
const blocked = (action) => assert.rejects(action, (e) => e.exitCode === 3);
const hifi = (dir) => variants({ run: dir, stage: "hifi" });
const build = (dir) => run({ _: ["build"], out: dir });

for (const mode of ["pick", "vote"])
  test(`changed ${mode} blocks old approvals until current variant and hifi are approved`, async (t) => {
    const dir = await fixture(t);
    if (mode === "pick")
      await variants({ run: dir, stage: "pick", pick: "v2" });
    else
      await board({
        captures: path.join(dir, "variants.json"),
        votes: path.join(dir, "votes.json"),
        mode: "variants", vote: "v2=like:layout",
      });
    assert.equal((await readJSON(path.join(dir, "next.json"))).step, "variant");
    await blocked(() => hifi(dir));
    await blocked(() => build(dir));
    await approveGate(dir, "variant", "revise");
    await blocked(() => hifi(dir));
    await approveGate(dir, "variant");
    // A build request must not allow approving the old hifi before regenerating it.
    await blocked(() => build(dir));
    await hifi(dir);
    assert.equal(await fs.readFile(path.join(dir, "preview/hifi.html"), "utf8"),
      "<main>Different design</main>");
    await blocked(() => build(dir));
    await approveGate(dir, "hifi", "revise");
    await blocked(() => build(dir));
    await approveGate(dir, "hifi");
    assert.equal((await build(dir)).step, "build");
  });

test("unchanged pick, repeated approvals and unchanged hifi resume keep approval", async (t) => {
  const dir = await fixture(t);
  await variants({ run: dir, stage: "pick", pick: "v1" });
  await approveGate(dir, "variant");
  await approveGate(dir, "variant");
  await hifi(dir);
  assert.equal((await build(dir)).step, "build");
});

test("switching back to an earlier pick cannot restore its old approvals", async (t) => {
  const dir = await fixture(t);
  await variants({ run: dir, stage: "pick", pick: "v2" });
  await variants({ run: dir, stage: "pick", pick: "v1" });
  await blocked(() => hifi(dir));
  await blocked(() => build(dir));
});

test("repeating a board vote does not replay historical picks or revoke approval", async (t) => {
  const dir = await fixture(t);
  const vote = (cid) => board({
    captures: path.join(dir, "variants.json"),
    votes: path.join(dir, "votes.json"), mode: "variants", vote: `${cid}=like:layout`,
  });
  await vote("v1");
  await vote("v2");
  await approveGate(dir, "variant");
  await hifi(dir);
  await approveGate(dir, "hifi");
  await vote("v2");
  assert.equal((await build(dir)).step, "build");
});
