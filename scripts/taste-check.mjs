import path from "node:path";
import { cli, readJSON } from "./lib/io.mjs";
import { checkAxes, checkTasteTokens } from "./lib/taste-check.mjs";
import { openBrowser } from "./lib/browser.mjs";
import { measure, makeFingerprint } from "./inspire-capture.mjs";
import { previewServer } from "./preview-serve.mjs";
export { checkTasteTokens };
export async function tasteCheck(o) {
  const taste = await readJSON(o.taste);
  if (!Object.values(taste.axes).some((a) => Math.abs(a.strength) >= 0.5))
    return { ok: true, score: 1, violations: [], unchecked: [] };
  if (o.tokens) return checkTasteTokens(taste, await readJSON(o.tokens));
  const server = await previewServer({
    dir: o.root || path.dirname(o.html),
    feedback: path.join(path.dirname(o.html), "feedback.json"),
  });
  let browser;
  try {
    ({ browser } = await openBrowser());
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(
      server.url +
        "/" +
        path
          .relative(o.root || path.dirname(o.html), o.html)
          .split(path.sep)
          .join("/"),
    );
    return checkAxes(taste, makeFingerprint(await measure(page)), o.html);
  } finally {
    await browser?.close();
    await server.close();
  }
}
cli(import.meta.url, async (o) => {
  const r = await tasteCheck(o);
  if (!r.ok) process.exitCode = 1;
  return r;
});
