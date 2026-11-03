import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepare } from "../scripts/preview-prepare.mjs";
import { previewServer, locateFeedback } from "../scripts/preview-serve.mjs";
import { openBrowser } from "../scripts/lib/browser.mjs";
import { write, writeJSON, readJSON } from "../scripts/lib/io.mjs";
export async function previewFixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-preview-"));
  await write(path.join(dir, "tokens.css"), ":root { --color-primary: blue; }");
  await writeJSON(path.join(dir, "tokens.json"), {
    color: { primary: { $type: "color", $value: "#0000ff" } },
  });
  await write(
    path.join(dir, "x.html"),
    '<!doctype html><html><head><title>Preview fixture</title></head><body><main data-ds-id="ds-1"><section><button>One</button><button>Two</button></section></main></body></html>',
  );
  return dir;
}
test("prepare is byte stable and rejects external resources", async () => {
  const dir = await previewFixture();
  try {
    const o = {
      file: path.join(dir, "x.html"),
      "tokens-css": path.join(dir, "tokens.css"),
    };
    const first = await prepare(o);
    assert.ok(first.added.length);
    const once = await fs.readFile(o.file, "utf8");
    await prepare(o);
    assert.equal(await fs.readFile(o.file, "utf8"), once);
    await write(
      o.file,
      once.replace(
        "</head>",
        '<script src="https://invalid.test/a.js"></script></head>',
      ),
    );
    await assert.rejects(() => prepare(o), /External/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("click, rectangle and CLI point resolve stable IDs", async () => {
  const dir = await previewFixture();
  let s, b;
  try {
    await prepare({
      file: path.join(dir, "x.html"),
      "tokens-css": path.join(dir, "tokens.css"),
    });
    s = await previewServer({ dir, feedback: path.join(dir, "feedback.json") });
    ({ browser: b } = await openBrowser());
    const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(s.url + "/x.html");
    const button = page.locator("button").first(),
      box = await button.boundingBox(),
      id = await button.getAttribute("data-ds-id");
    const located = await locateFeedback(page, {
      point: `${box.x + 2},${box.y + 2}`,
    });
    assert.deepEqual(located, [id]);
    await page.click("button");
    await page.fill("#dfs-comment", "More emphasis");
    await page.click("#dfs-save");
    await page.waitForFunction(
      () => document.querySelector("#dfs-status").textContent === "Saved",
    );
    assert.deepEqual(
      (await readJSON(path.join(dir, "feedback.json"))).items[0].targetIds,
      [id],
    );
    assert.deepEqual(
      await locateFeedback(page, {
        rect: `${box.x},${box.y},${box.width + 50},${box.height}`,
      }),
      [await page.locator("section").getAttribute("data-ds-id")],
    );
    assert.equal(s.host, "127.0.0.1");
  } finally {
    await b?.close();
    await s?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
