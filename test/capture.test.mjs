import { test } from "node:test";
import assert from "node:assert/strict";
import { capture, makeFingerprint } from "../scripts/inspire-capture.mjs";
import { serve } from "./helpers/serve.mjs";
import { readJSON, files } from "../scripts/lib/io.mjs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
test("fingerprint arithmetic classifies measured colors and fonts", () => {
  const fp = makeFingerprint({
    background: "#101820",
    colors: [{ value: "#101820", area: 100 }],
    fonts: ["Georgia, serif"],
    basePx: 16,
    headingPx: 48,
    radii: [0, 0],
    visibleArea: 100,
    viewportArea: 200,
    textArea: 50,
    imageArea: 0,
    animations: 0,
    keyframes: 0,
    layout: "centered",
  });
  assert.equal(fp.theme, "dark");
  assert.equal(fp.fontClass.serif, 1);
  assert.equal(fp.radiusPx, 0);
});
test("eight original styles produce accurate fingerprints; dead URL is removed", async () => {
  const s = await serve("test/fixtures");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-capture-"));
  try {
    const ex = await readJSON("test/fixtures/expected/fingerprints.json");
    const r = await capture({
      candidates: {
        candidates: [
          ...ex.map((e) => ({ cid: e.cid, siteUrl: s.url + e.path })),
          { cid: "bad", siteUrl: "http://127.0.0.1:1/" },
        ],
      },
      out: path.join(dir, "captures.json"),
    });
    assert.equal(r.captures.length, 8);
    for (const c of r.captures) {
      const e = ex.find((e) => e.cid === c.cid);
      assert.equal(c.fp.theme, e.theme);
      assert.ok(Math.abs(c.fp.radiusPx - e.radiusPx) <= 1);
      assert.equal(
        Object.entries(c.fp.fontClass).sort((a, b) => b[1] - a[1])[0][0],
        e.fontClass,
      );
      assert.ok(c.thumb.includes(".cache/design-from-sites"));
      assert.ok(c.browser.name);
    }
    assert.equal(
      (await files("test/fixtures/styles")).filter((p) =>
        /\.(png|jpg|webp)$/.test(p),
      ).length,
      0,
    );
  } finally {
    await s.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("403, Cloudflare challenge and black fixtures are rejected with reasons, including recaptures", async () => {
  const s = await serve("test/fixtures", {
    "/capture-rejections/forbidden.html": { status: 403 },
  });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-invalid-capture-"));
  try {
    const out = path.join(dir, "captures.json");
    const candidates = ["forbidden", "challenge", "black"].map((cid) => ({
      cid,
      siteUrl: `${s.url}/capture-rejections/${cid}.html`,
    }));
    await fs.writeFile(
      out,
      JSON.stringify({
        captures: candidates.map((c) => ({ cid: c.cid, ok: true })),
      }),
    );
    const result = await capture({ candidates: { candidates }, out });
    assert.deepEqual(result.captures, []);
    assert.deepEqual(result.currentCids, []);
    assert.equal(result.rejected.length, 3);
    for (const [cid, pattern] of [
      ["forbidden", /403/],
      ["challenge", /challenge|blocked|Just a moment/i],
      ["black", /single|uniform|monochrome/i],
    ])
      assert.match(
        result.rejected.find((r) => r.cid === cid)?.reason || "",
        pattern,
      );
  } finally {
    await s.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
