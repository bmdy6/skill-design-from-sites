import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "../scripts/run.mjs";
import { readJSON, writeJSON, write, files } from "../scripts/lib/io.mjs";
import { serve } from "./helpers/serve.mjs";
import { collect } from "../scripts/collect.mjs";
import { extractRaw } from "../scripts/extract.mjs";
import { buildTokens } from "../scripts/build-tokens.mjs";
import { emit } from "../scripts/emit.mjs";
import { verifySources } from "../scripts/verify-sources.mjs";
import { sections } from "../scripts/lint-design-md.mjs";
async function answerAll(dir, mode, answers) {
  let r = await run({ _: ["intake"], mode, out: dir });
  for (const answer of answers)
    r = await run({
      _: ["intake"],
      mode,
      out: dir,
      answer: JSON.stringify(answer),
    });
  return r;
}
async function approve(dir, gate) {
  return run({ _: ["approve"], out: dir, gate });
}
async function draftsToBuild(dir, company = false) {
  await run({ _: ["preview"], out: dir, stage: "wire" });
  assert.equal((await readJSON(path.join(dir, "next.json"))).step, "wire");
  await approve(dir, "wire");
  await run({ _: ["preview"], out: dir, stage: "variants" });
  await run({ _: ["preview"], out: dir, stage: "pick", pick: "v1" });
  assert.equal((await readJSON(path.join(dir, "next.json"))).step, "variant");
  await approve(dir, "variant");
  await run({ _: ["preview"], out: dir, stage: "hifi" });
  assert.equal((await readJSON(path.join(dir, "next.json"))).step, "hifi");
  await assert.rejects(
    () => run({ _: ["build"], out: dir }),
    (e) => e.exitCode === 3,
  );
  await approve(dir, "hifi");
  assert.equal((await run({ _: ["build"], out: dir })).step, "build");
  if (company) {
    const variants = await readJSON(path.join(dir, "variants.json"));
    for (const v of variants.variants) assert.ok(v.basis.length);
  }
}
test("company local-code workflow enforces every gate and keeps external screenshots out", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-company-e2e-"));
  try {
    await answerAll(dir, "company", [
      "Improve a reading page",
      "Readers",
      path.resolve("test/fixtures/baseline"),
      ["structure"],
      ["color"],
      false,
      ["spec", "wire", "variant", "hifi"],
    ]);
    const spec = await readJSON(path.join(dir, "next.json"));
    assert.equal(spec.step, "spec");
    assert.equal(spec.approver, "boss");
    await assert.rejects(
      () => run({ _: ["baseline"], out: dir }),
      (e) => e.exitCode === 3,
    );
    await approve(dir, "spec");
    assert.equal(
      (await readJSON(path.join(dir, "gates.json"))).items[0].by,
      "user-on-behalf-of-boss",
    );
    await run({ _: ["boss"], out: dir, none: true });
    await run({ _: ["baseline"], out: dir });
    await run({ _: ["taste"], out: dir });
    await approve(dir, "taste");
    await run({ _: ["tokens"], out: dir });
    const report = await readJSON(path.join(dir, "merge-report.json"));
    assert.equal(report.primarySite, "baseline");
    assert.ok(report.choices.every((c) => c.basis.length));
    await write(
      path.join(dir, "DESIGN.md"),
      sections.map((s) => "## " + s + "\nUse `color.primary`.").join("\n"),
    );
    await draftsToBuild(dir, true);
    for (const f of await files(dir)) {
      if (!/\.(json|md|html)$/.test(f)) continue;
      const text = await fs.readFile(f, "utf8");
      assert.doesNotMatch(text, /https?:[^\s"<>]*\.(?:png|webp|jpg)/i);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("personal original-page workflow collects, verifies and reaches approved build", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-personal-e2e-")),
    server = await serve("test/fixtures");
  try {
    await answerAll(dir, "personal", [
      "A focused landing page",
      ["landing"],
      {
        references: [
          { url: server.url + "/site-a/", note: "Original fixture" },
        ],
        needInspire: false,
      },
      ["calm"],
      ["busy"],
    ]);
    await writeJSON(path.join(dir, "taste.json"), {
      schemaVersion: 1,
      owner: "self",
      rounds: 1,
      likes: ["a"],
      dislikes: [],
      axes: {},
      references: [{ cid: "a", url: server.url + "/site-a/", role: "primary" }],
      rules: [],
      confidence: "medium",
      history: [],
    });
    await writeJSON(path.join(dir, "next.json"), {
      step: "taste",
      gate: "user",
      approver: "user",
    });
    await approve(dir, "taste");
    const raws = await collect({
        url: server.url + "/site-a/",
        "site-id": "a",
        out: dir,
      }),
      e = extractRaw(raws);
    await writeJSON(path.join(dir, "evidence/a.json"), e);
    const by = (value) => e.clusters.color.find((c) => c.value === value).id;
    await writeJSON(path.join(dir, "labels/a.json"), {
      siteId: "a",
      color: {
        primary: by("#2563eb"),
        surface: by("#ffffff"),
        text: by("#172033"),
      },
      fontFamily: { body: e.clusters.fontFamily[0].id },
      shadow: {},
      components: {},
      styleSummary: "Original fixture",
    });
    await run({ _: ["tokens"], out: dir });
    await draftsToBuild(dir);
  } finally {
    await server.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("no-reference personal branch discovers original cards, votes and reaches build", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-inspire-e2e-")),
    source = await serve("test/fixtures");
  let gallery;
  try {
    const port = new URL(source.url).port;
    await write(
      path.join(dir, "gallery/robots.txt"),
      "User-agent: *\nAllow: /\n",
    );
    const cards = Array.from(
      { length: 8 },
      (_, i) =>
        `<article><a data-site-url="http://style-${i}.localhost:${port}/styles/style-${i}/" data-tags="${i < 4 ? "dark" : "light"},${i % 4 < 2 ? "serif" : "sans"}" href="/item-${i}">Original direction ${i}</a></article>`,
    ).join("");
    await write(
      path.join(dir, "gallery/index.html"),
      "<!doctype html><html><body>" + cards + "</body></html>",
    );
    gallery = await serve(path.join(dir, "gallery"));
    await writeJSON(path.join(dir, "sources.json"), [
      { name: "awwwards", url: gallery.url + "/" },
    ]);
    const out = path.join(dir, "run");
    await answerAll(out, "personal", [
      "A clear landing page",
      ["landing"],
      { references: [], needInspire: true },
      ["calm"],
      ["busy"],
    ]);
    await run({ _: ["taste"], out, sources: path.join(dir, "sources.json") });
    assert.equal((await readJSON(path.join(out, "next.json"))).step, "capture");
    await run({ _: ["taste"], out, phase: "capture" });
    const captured = await readJSON(path.join(out, "inspire/captures.json"));
    assert.equal(captured.captures.length, 8);
    const vote = captured.captures
      .map(
        (c) => `${c.cid}=${c.fp.theme === "dark" ? "like" : "dislike"}:color`,
      )
      .join(";");
    await run({ _: ["taste"], out, phase: "vote", vote });
    await run({ _: ["taste"], out, phase: "build" });
    await approve(out, "taste");
    await run({ _: ["extract"], out });
    const evidenceDir = path.join(out, "evidence");
    for (const name of await fs.readdir(evidenceDir)) {
      const e = await readJSON(path.join(evidenceDir, name));
      const by = (value) => e.clusters.color.find((c) => c.value === value).id;
      await writeJSON(path.join(out, "labels", name), {
        siteId: e.siteId,
        color: {
          primary: by("#b56320"),
          surface: by("#101820"),
          text: by("#f5f5f0"),
        },
        fontFamily: { body: e.clusters.fontFamily[0].id },
        shadow: {},
        components: {},
        styleSummary: "Original dark direction",
      });
    }
    await run({ _: ["tokens"], out });
    await draftsToBuild(out);
  } finally {
    await gallery?.close();
    await source.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
