import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { openBrowser } from "../scripts/lib/browser.mjs";
import { navigateForCollection } from "../scripts/lib/navigation.mjs";
import { serve } from "./helpers/serve.mjs";

test("a page with an unfinished request remains collectable", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-busy-page-"));
  let server, browser;
  try {
    await fs.writeFile(
      path.join(dir, "index.html"),
      '<!doctype html><h1>Original busy fixture</h1><script>fetch("/persistent")</script>',
    );
    server = await serve(dir);
    ({ browser } = await openBrowser());
    const page = await browser.newPage();
    let pending = false;
    await page.route("**/persistent", () => {
      pending = true;
    });
    const started = Date.now();
    await navigateForCollection(page, server.url);
    assert.equal(pending, true);
    assert.equal(await page.locator("h1").innerText(), "Original busy fixture");
    assert.ok(Date.now() - started < 7000, "idle wait must be bounded");
  } finally {
    await browser?.close();
    await server?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
