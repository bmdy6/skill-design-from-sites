import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { serve } from "./helpers/serve.mjs";
import { collect } from "../scripts/collect.mjs";
import { extractRaw } from "../scripts/extract.mjs";
import { validate } from "../scripts/lib/schema.mjs";
import { readJSON } from "../scripts/lib/io.mjs";
test("CDP collector preserves coordinates and never requests assets", async () => {
  const s = await serve("test/fixtures");
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-collect-"));
  try {
    const start = Date.now();
    const raw = await collect({ url: s.url + "/site-a/", "site-id": "a", out });
    assert.equal(raw.length, 2);
    for (const r of raw) {
      validate("raw", r);
      assert.ok(r.fonts.some((f) => f.family === "Fixture Sans"));
      assert.ok(r.elements.length > 5);
      assert.ok(
        r.decls.flatMap((d) => d.samples).some((s) => s.origin === "inline"),
      );
      const button = r.decls.find((d) =>
        d.key.startsWith("background-color|rgb(37, 99, 235)"),
      ).samples[0];
      const ex = await readJSON("test/fixtures/expected/site-a.json");
      assert.equal(button.line, ex.button.line);
      assert.ok(button.stylesheet.endsWith("/main.css"));
      const min = r.decls.find((d) => d.key === "color|rgb(52, 86, 120)")
        .samples[0];
      assert.equal(min.line, 1);
      assert.equal(min.column, 6);
      for (const e of r.elements) assert.ok(e.bbox[2] > 1 && e.bbox[3] > 1);
    }
    assert.equal(
      s.requests.filter((r) => /\.(png|jpg|svg|woff2|mp4)(\?|$)/.test(r.url))
        .length,
      0,
    );
    assert.ok(Date.now() - start < 60000);
  } finally {
    await s.close();
    await fs.rm(out, { recursive: true, force: true });
  }
});

test("out-of-page crops are skipped and partial crops intersect capture bounds", async () => {
  const s = await serve("test/fixtures");
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-crop-bounds-"));
  try {
    const raws = await collect({
      url: s.url + "/crop-bounds/",
      "site-id": "bounds",
      out,
    });
    assert.equal(raws.length, 2);
    const evidence = extractRaw(raws);
    for (const raw of raws) {
      const saved = await readJSON(
        path.join(out, "raw/bounds", raw.viewport.name + ".json"),
      );
      const outside = raw.elements.find((e) => e.selector === "#outside");
      assert.ok(outside);
      const skipped = saved.decls
        .flatMap((d) => d.samples)
        .filter((s) => s.eid === outside.eid);
      assert.ok(skipped.length > 1);
      for (const sample of skipped) {
        assert.equal(sample.crop, null);
        assert.match(sample.cropReason, /outside/i);
        await assert.rejects(
          fs.access(path.join(out, "crops/bounds", sample.sid + ".png")),
        );
      }
      const extractedSkipped = skipped.filter((s) => evidence.samples[s.sid]);
      assert.ok(extractedSkipped.length > 0);
      for (const sample of extractedSkipped) {
        assert.equal(evidence.samples[sample.sid].crop, null);
        assert.equal(evidence.samples[sample.sid].cropReason, sample.cropReason);
      }
      for (const [selector, width, height] of [
        ["#partial", 60, 30],
        ["#limit", 80, 10],
        ["#normal", 80, 40],
      ]) {
        const element = raw.elements.find((e) => e.selector === selector);
        const sample = saved.decls
          .flatMap((d) => d.samples)
          .find((s) => s.eid === element.eid && evidence.samples[s.sid]);
        const png = await fs.readFile(path.join(out, sample.crop));
        assert.equal(png.readUInt32BE(16), width);
        assert.equal(png.readUInt32BE(20), height);
        assert.equal(evidence.samples[sample.sid].crop, sample.crop);
      }
    }
  } finally {
    await s.close();
    await fs.rm(out, { recursive: true, force: true });
  }
});

test("strict style CSP still produces raw JSON and sanitized screenshots", async () => {
  const s = await serve("test/fixtures", {
    "/capture-rejections/csp.html": {
      headers: { "Content-Security-Policy": "style-src 'self'" },
    },
  });
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-csp-collect-"));
  try {
    const raws = await collect({
      url: s.url + "/capture-rejections/csp.html",
      "site-id": "csp",
      out,
    });
    assert.equal(raws.length, 2);
    for (const raw of raws) {
      const saved = await readJSON(
        path.join(out, "raw/csp", raw.viewport.name + ".json"),
      );
      assert.ok(saved.elements.some((e) => e.tag === "button"));
      await fs.access(path.join(out, "raw/csp", raw.viewport.name + ".png"));
    }
  } finally {
    await s.close();
    await fs.rm(out, { recursive: true, force: true });
  }
});

import { openBrowser } from "../scripts/lib/browser.mjs";
for (const stage of ["Screenshot", "Crop"])
  test(`${stage} style injection failure warns and preserves raw JSON without unsafe crops`, async (t) => {
    const s = await serve("test/fixtures");
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-style-failure-"));
    const { browser } = await openBrowser();
    try {
      const page = await browser.newPage();
      const prototype = Object.getPrototypeOf(page);
      const original = prototype.addStyleTag;
      t.mock.method(prototype, "addStyleTag", async function (options) {
        const isCrop = options.content.includes("text-shadow");
        if (isCrop === (stage === "Crop"))
          throw Error("fixture injection failure");
        return original.call(this, options);
      });
      await browser.close();
      const raws = await collect({
        url: s.url + "/capture-rejections/csp.html",
        "site-id": "failure",
        out,
      });
      assert.equal(raws.length, 2);
      for (const raw of raws) {
        const saved = await readJSON(
          path.join(out, "raw/failure", raw.viewport.name + ".json"),
        );
        assert.equal(saved.warnings.length, 1);
        assert.match(
          saved.warnings[0],
          new RegExp(
            `${stage} style injection failed: fixture injection failure`,
          ),
        );
        for (const sample of saved.decls.flatMap((d) => d.samples)) {
          assert.equal(sample.crop, null);
          assert.match(sample.cropReason, /style injection failed/i);
        }
        const shot = path.join(out, "raw/failure", raw.viewport.name + ".png");
        if (stage === "Screenshot") await assert.rejects(fs.access(shot));
        else await fs.access(shot);
        assert.deepEqual(await fs.readdir(path.join(out, "crops/failure")), []);
      }
    } finally {
      t.mock.restoreAll();
      await browser.close();
      await s.close();
      await fs.rm(out, { recursive: true, force: true });
    }
  });
