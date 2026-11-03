import { navigateForCollection } from "./lib/navigation.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { cli, readJSON, writeJSON } from "./lib/io.mjs";
import { openBrowser, blockAssets } from "./lib/browser.mjs";
import { setupCDP } from "./lib/cdp-source.mjs";
export function verifyDeclaration(
  text,
  line,
  column,
  authoredValue,
  header = {},
) {
  if (!line || !column || !authoredValue) return false;
  const relativeLine = line - (header.startLine || 0),
    relativeColumn =
      column - (relativeLine === 1 ? header.startColumn || 0 : 0);
  const lines = text.split("\n");
  const source = lines[relativeLine - 1];
  if (!source || relativeColumn < 1) return false;
  const offset =
    lines.slice(0, relativeLine - 1).reduce((n, s) => n + s.length + 1, 0) +
    relativeColumn -
    1;
  const tail = text.slice(offset);
  if (tail.startsWith(authoredValue)) return true;
  const declaration = source.slice(relativeColumn - 1).split(";")[0];
  const colon = declaration.indexOf(":");
  return (
    colon >= 0 &&
    declaration
      .slice(colon + 1)
      .trimStart()
      .startsWith(authoredValue)
  );
}
export function sampleSources(sources, n, seed) {
  let state = Number(seed) || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const list = Object.entries(sources)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([token, s]) =>
      s.evidence
        .filter((e) => e.selector && e.line && e.stylesheet)
        .slice(0, 1)
        .map((e) => ({ token, ...e })),
    );
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, n);
}
export async function verifySources(o) {
  const selected = sampleSources(
      await readJSON(path.join(o.run, "sources.json")),
      Number(o.sample || 10),
      Number(o.seed || 1),
    ),
    failures = [];
  let browser;
  try {
    for (const s of selected) {
      if (s.viewport === "code") {
        try {
          const text = await fs.readFile(s.stylesheet, "utf8");
          if (!verifyDeclaration(text, s.line, s.column, s.authoredValue))
            failures.push({
              token: s.token,
              reason: "Local declaration missing at recorded line:column",
            });
        } catch (e) {
          failures.push({ token: s.token, reason: e.message });
        }
        continue;
      }
      if (!browser) ({ browser } = await openBrowser({ css: true }));
      const context = await browser.newContext({
        viewport:
          s.viewport === "mobile"
            ? { width: 390, height: 844 }
            : { width: 1440, height: 900 },
        serviceWorkers: "block",
      });
      try {
        await blockAssets(context);
        const page = await context.newPage(),
          cdp = await setupCDP(context, page);
        await navigateForCollection(page, s.url);
        let matched = false;
        for (const h of cdp.headers.values()) {
          if (h.sourceURL !== s.stylesheet) continue;
          const { text } = await cdp.session.send("CSS.getStyleSheetText", {
            styleSheetId: h.styleSheetId,
          });
          if (verifyDeclaration(text, s.line, s.column, s.authoredValue, h)) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          failures.push({
            token: s.token,
            reason: "Authored declaration missing at recorded line:column",
          });
          continue;
        }
        const computed = await page.evaluate((s) => {
          const e = document.querySelector(s.selector);
          return e ? getComputedStyle(e).getPropertyValue(s.property) : null;
        }, s);
        if (computed !== s.value)
          failures.push({
            token: s.token,
            reason: `Computed value changed: ${computed}`,
          });
      } catch (e) {
        failures.push({ token: s.token, reason: e.message.split("\n")[0] });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
  }
  const result = {
    sampled: selected.length,
    passed: selected.length - failures.length,
    failures,
  };
  await writeJSON(path.join(o.run, "verify-report.json"), result);
  return result;
}
cli(import.meta.url, async (o) => {
  const r = await verifySources(o);
  if (r.failures.length || r.sampled < Number(o.sample || 10))
    process.exitCode = 1;
  return r;
});
