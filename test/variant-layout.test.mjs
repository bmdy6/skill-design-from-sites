import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { variantHTML } from "../scripts/preview-variants.mjs";
import { openBrowser } from "../scripts/lib/browser.mjs";
import { inputs } from "./helpers/tokens.mjs";
import { buildTokens } from "../scripts/build-tokens.mjs";
import { emit } from "../scripts/emit.mjs";
import { writeJSON, write } from "../scripts/lib/io.mjs";
import { serve } from "./helpers/serve.mjs";

test("directions have distinct geometry and fit mobile through desktop", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-layout-"));
  let browser, server;
  try {
    const { evidence, labels } = inputs(),
      tokens = buildTokens(evidence, labels).tokens;
    await writeJSON(path.join(dir, "tokens.json"), tokens);
    await emit({ tokens: path.join(dir, "tokens.json"), out: dir });
    for (const layout of ["centered", "split", "editorial"])
      await write(
        path.join(dir, "preview", layout + ".html"),
        variantHTML(tokens, layout),
      );
    server = await serve(dir);
    ({ browser } = await openBrowser());
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const boxes = {};
      for (const layout of ["centered", "split", "editorial"]) {
        await page.goto(server.url + "/preview/" + layout + ".html");
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${layout} overflows at ${width}`,
        );
        boxes[layout] = await page.locator("article").evaluateAll((items) =>
          items.map((e) => {
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }),
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(() => document.activeElement.tagName),
          "BUTTON",
        );
      }
      if (width > 600) {
        const [c1, c2] = boxes.centered,
          [s1, s2] = boxes.split,
          [e1, e2, e3] = boxes.editorial;
        assert.ok(
          Math.abs(c1.width - c2.width) < 1 && c1.x < c2.x && c1.y === c2.y,
          "centered uses equal columns",
        );
        assert.ok(s1.x === s2.x && s1.y < s2.y, "split stacks beside intro");
        assert.ok(
          e1.width > e2.width * 1.5 && e1.height > e2.height * 1.5,
          "editorial has dominant lead",
        );
        assert.ok(
          e2.x === e3.x && e2.y < e3.y,
          "editorial stacks secondary stories",
        );
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
