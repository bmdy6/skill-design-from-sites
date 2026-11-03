// Reproducible visual evidence. Inputs are exclusively original repository fixtures.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { cli, writeJSON, write } from "./lib/io.mjs";
import { openBrowser } from "./lib/browser.mjs";
import { serve } from "../test/helpers/serve.mjs";
import { capture } from "./inspire-capture.mjs";
import { board } from "./inspire-board.mjs";
import { inputs } from "../test/helpers/tokens.mjs";
import { buildTokens } from "./build-tokens.mjs";
import { emit } from "./emit.mjs";
import { variantHTML, comparisonHTML } from "./preview-variants.mjs";
import { prepare } from "./preview-prepare.mjs";
import { previewServer } from "./preview-serve.mjs";
import { applyFragment } from "./revise-apply.mjs";
import { htmlTree, walk, attr } from "./lib/html.mjs";
import { shareHTML } from "./taste-share.mjs";
import { tasteBuild } from "./taste-build.mjs";
import { tasteInputs } from "../test/helpers/taste.mjs";
export async function screenshots(o) {
  const run = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-shots-")),
    out = path.resolve(o.out || "docs/screenshots");
  await fs.mkdir(out, { recursive: true });
  const source = await serve(
    fileURLToPath(new URL("../test/fixtures", import.meta.url)),
  );
  let ui, local, browser;
  try {
    await capture({
      candidates: {
        round: 1,
        candidates: [0, 2, 5, 7].map((i, j) => ({
          cid: "k" + (j + 1),
          title: "Original style " + i,
          siteUrl: source.url + "/styles/style-" + i + "/",
          galleryUrl: "",
        })),
      },
      out: path.join(run, "captures.json"),
    });
    ui = await board({
      captures: path.join(run, "captures.json"),
      votes: path.join(run, "votes.json"),
      open: false,
    });
    ({ browser } = await openBrowser());
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(ui.url);
    await page.screenshot({
      path: path.join(out, "inspiration-board.png"),
      fullPage: true,
    });
    const { evidence, labels } = inputs(),
      tokens = buildTokens(evidence, labels).tokens;
    await writeJSON(path.join(run, "tokens.json"), tokens);
    await emit({ tokens: path.join(run, "tokens.json"), out: run });
    const state = { variants: [] };
    for (const [i, layout] of ["centered", "split", "editorial"].entries()) {
      const file = "preview/v" + (i + 1) + ".html";
      await write(path.join(run, file), variantHTML(tokens, layout));
      await prepare({
        file: path.join(run, file),
        "tokens-css": path.join(run, "tokens.css"),
      });
      state.variants.push({
        id: "v" + (i + 1),
        layout,
        file,
        rationale: "Original fixture with " + layout + " structure",
      });
    }
    await write(path.join(run, "preview/compare.html"), comparisonHTML(state));
    const tasteData = tasteInputs(),
      taste = tasteBuild(tasteData.captures, tasteData.votes);
    taste.references = taste.references.map((r) => ({
      ...r,
      url: source.url + "/styles/style-0/",
    }));
    taste.rules = [
      {
        text: "偏向深色、利落的边缘与清楚的层次。",
        axis: "theme",
        evidence: ["k1"],
      },
    ];
    await write(path.join(run, "taste-share.html"), shareHTML(taste, tokens));
    local = await previewServer({
      dir: run,
      feedback: path.join(run, "feedback.json"),
    });
    await page.goto(local.url + "/preview/compare.html");
    await page.locator("#dfs-overlay").evaluate((e) => e.remove());
    await page.screenshot({
      path: path.join(out, "variant-comparison.png"),
      fullPage: true,
    });
    await page.goto(local.url + "/preview/v1.html");
    await page.locator("#dfs-overlay").evaluate((e) => e.remove());
    await page.screenshot({
      path: path.join(out, "preview-before.png"),
      fullPage: true,
    });
    const file = path.join(run, "preview/v1.html"),
      original = await fs.readFile(file, "utf8");
    let target;
    walk(htmlTree(original), (n) => {
      if (!target && n.tagName === "article") target = n;
    });
    const loc = target.sourceCodeLocation,
      fragment = original
        .slice(loc.startOffset, loc.endOffset)
        .replace("A clear beginning", "A calmer starting point")
        .replace(
          "Find a rhythm that works for you.",
          "Make one clear choice, then take the next step.",
        );
    const revised = applyFragment(
      original,
      attr(target, "data-ds-id"),
      fragment,
      tokens,
    );
    await write(file, revised.html);
    await page.reload();
    await page.locator("#dfs-overlay").evaluate((e) => e.remove());
    await page.screenshot({
      path: path.join(out, "preview-after.png"),
      fullPage: true,
    });
    await page.goto(local.url + "/taste-share.html");
    await page.locator("#dfs-overlay").evaluate((e) => e.remove());
    await page.screenshot({
      path: path.join(out, "taste-share.png"),
      fullPage: true,
    });
    return { ok: true, out, files: await fs.readdir(out) };
  } finally {
    await browser?.close();
    await local?.close();
    await ui?.close();
    await source.close();
    await fs.rm(run, { recursive: true, force: true });
  }
}
cli(import.meta.url, screenshots);
