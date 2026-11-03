import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { board, voteCLI, recordVote } from "../scripts/inspire-board.mjs";
import { openBrowser } from "../scripts/lib/browser.mjs";
import { writeJSON, readJSON } from "../scripts/lib/io.mjs";
test("CLI voting validates choices and records aspect-limited preferences", () => {
  const v = voteCLI(
    "k3=like:color,layout;k2=dislike",
    { items: [] },
    { by: "self", round: 1, at: "fixed" },
  );
  assert.equal(v.items.length, 2);
  assert.deepEqual(v.items[0].aspects, ["color", "layout"]);
  assert.throws(() => voteCLI("k1=maybe", { items: [] }));
  assert.throws(() =>
    recordVote(
      { items: [] },
      { cid: "k1", vote: "like", aspects: ["unknown"] },
    ),
  );
});
test("board UI and CLI save equivalent votes over localhost", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-board-"));
  let s, b;
  try {
    const captures = {
      captures: [
        {
          cid: "k1",
          url: "https://fixture.invalid",
          galleryUrl: "",
          title: "Original fixture",
          thumb: "",
          fp: { theme: "dark" },
        },
      ],
    };
    await writeJSON(path.join(dir, "captures.json"), captures);
    s = await board({
      captures: path.join(dir, "captures.json"),
      votes: path.join(dir, "votes.json"),
      open: false,
    });
    assert.match(s.url, /127\.0\.0\.1/);
    ({ browser: b } = await openBrowser());
    const page = await b.newPage();
    await page.goto(s.url);
    await page.check('[name="k1-color"]');
    await page.click('[data-cid="k1"][data-vote="like"]');
    await page.waitForFunction(
      () => document.querySelector("[role=status]").textContent === "Saved",
    );
    const item = (await readJSON(path.join(dir, "votes.json"))).items[0],
      cli = voteCLI("k1=like:color", { items: [] }).items[0];
    for (const k of ["cid", "vote", "aspects", "by", "round"])
      assert.deepEqual(item[k], cli[k]);
  } finally {
    await b?.close();
    await s?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("variant votes record selection and preserve final user approval gate", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-variant-vote-"));
  try {
    await writeJSON(path.join(dir, "variants.json"), {
      variants: [{ id: "v1", layout: "split", file: "preview/v1.html" }],
      picked: null,
    });
    await board({
      captures: path.join(dir, "variants.json"),
      votes: path.join(dir, "votes.json"),
      mode: "variants",
      vote: "v1=like:layout",
    });
    assert.equal(
      (await readJSON(path.join(dir, "variants.json"))).picked,
      "v1",
    );
    assert.equal((await readJSON(path.join(dir, "next.json"))).gate, "user");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
