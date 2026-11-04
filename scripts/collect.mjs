import { navigateForCollection } from "./lib/navigation.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import { cli, writeJSON, fail } from "./lib/io.mjs";
import { openBrowser, blockAssets } from "./lib/browser.mjs";
import { setupCDP, sourceFor } from "./lib/cdp-source.mjs";
import { selectorFor } from "./lib/selector.mjs";
import { validate } from "./lib/schema.mjs";
export const properties = [
  "color",
  "background-color",
  "border-top-color",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-bottom",
  "gap",
  "border-top-left-radius",
  "box-shadow",
  "max-width",
];
export async function collect(o) {
  if (!o.url || !o.out || !o["site-id"]) fail("--url --site-id --out required");
  if (!/^[a-zA-Z0-9_-]+$/.test(o["site-id"])) fail("Invalid site ID");
  const { browser, info, steps } = await openBrowser({ css: true });
  const outputs = [];
  try {
    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        serviceWorkers: "block",
        bypassCSP: true,
        acceptDownloads: false,
      });
      try {
        const blocked = await blockAssets(context);
        const page = await context.newPage();
        const cdp = await setupCDP(context, page);
        await navigateForCollection(page, o.url);
        const elements = await page.evaluate(
          ({ props, selectorFn }) => {
            const selector = eval("(" + selectorFn + ")");
            return [...document.querySelectorAll("body, body *")]
              .filter((e) => {
                const r = e.getBoundingClientRect(),
                  s = getComputedStyle(e);
                return (
                  r.width > 1 &&
                  r.height > 1 &&
                  r.top + scrollY < 10000 &&
                  r.right > 0 &&
                  r.left < innerWidth &&
                  s.visibility !== "hidden" &&
                  s.display !== "none" &&
                  Number(s.opacity) !== 0 &&
                  (!e.checkVisibility ||
                    e.checkVisibility({
                      opacityProperty: true,
                      visibilityProperty: true,
                    })) &&
                  !["SCRIPT", "STYLE", "LINK", "SVG", "PATH", "RECT"].includes(
                    e.tagName,
                  )
                );
              })
              .slice(0, 5000)
              .map((e, eid) => {
                const r = e.getBoundingClientRect(),
                  s = getComputedStyle(e);
                let n = e.parentElement,
                  bg = "rgb(255, 255, 255)";
                while (n) {
                  const v = getComputedStyle(n).backgroundColor;
                  if (v !== "rgba(0, 0, 0, 0)" && v !== "transparent") {
                    bg = v;
                    break;
                  }
                  n = n.parentElement;
                }
                return {
                  eid,
                  tag: e.tagName.toLowerCase(),
                  role:
                    e.getAttribute("role") ||
                    (["button", "input"].includes(e.tagName.toLowerCase())
                      ? e.tagName.toLowerCase()
                      : ""),
                  selector: selector(e),
                  bbox: [
                    r.x + scrollX,
                    r.y + scrollY,
                    r.width,
                    Math.min(r.height, 10000),
                  ],
                  textLen: e.textContent.trim().length,
                  hasBgImage: s.backgroundImage !== "none",
                  parentBackground: bg,
                  styles: Object.fromEntries(
                    props.map((p) => [p, s.getPropertyValue(p)]),
                  ),
                };
              });
          },
          { props: properties, selectorFn: selectorFor.toString() },
        );
        const groups = new Map();
        for (const e of elements)
          for (const [p, v] of Object.entries(e.styles)) {
            const key = p + "|" + v;
            if (!groups.has(key))
              groups.set(key, {
                key,
                count: 0,
                area: 0,
                textLen: 0,
                elements: [],
              });
            const g = groups.get(key);
            g.count++;
            g.textLen += e.textLen;
            g.area += e.bbox[2] * e.bbox[3];
            g.elements.push(e);
          }
        const decls = [];
        let sid = 0;
        for (const g of groups.values()) {
          const samples = [];
          for (const e of g.elements
            .sort((a, b) => b.bbox[2] * b.bbox[3] - a.bbox[2] * a.bbox[3])
            .slice(0, 3)) {
            const source = await sourceFor(
              cdp,
              e.selector,
              g.key.split("|")[0],
            );
            samples.push({
              sid: `${viewport.name}-s${++sid}`,
              eid: e.eid,
              ...source,
            });
          }
          decls.push({
            key: g.key,
            count: g.count,
            area: g.area,
            textLen: g.textLen,
            samples,
          });
        }
        const cssVars = [],
          fonts = [];
        for (const h of cdp.headers.values()) {
          try {
            const { text } = await cdp.session.send("CSS.getStyleSheetText", {
              styleSheetId: h.styleSheetId,
            });
            const tree = postcss.parse(text);
            tree.walkDecls((d) => {
              const source = {
                stylesheet: h.sourceURL,
                line: (h.startLine || 0) + d.source.start.line,
                column: d.source.start.column,
              };
              if (d.prop.startsWith("--"))
                cssVars.push({
                  name: d.prop,
                  value: d.value,
                  scope: d.parent.selector || ":root",
                  source,
                });
            });
            tree.walkAtRules("font-face", (r) => {
              let family = "",
                weights = [];
              r.walkDecls((d) => {
                if (d.prop === "font-family")
                  family = d.value.replace(/["']/g, "");
                if (d.prop === "font-weight")
                  weights = d.value.split(/\s+/).map(Number);
              });
              fonts.push({
                family,
                weights,
                source: {
                  stylesheet: h.sourceURL,
                  line: (h.startLine || 0) + r.source.start.line,
                },
              });
            });
          } catch {
            /* inaccessible styles are retained through computed declarations */
          }
        }
        const raw = {
          schemaVersion: 1,
          siteId: o["site-id"],
          url: o.url,
          finalUrl: page.url(),
          collectedAt: new Date().toISOString(),
          browser: info,
          steps,
          viewport,
          blocked,
          cssVars,
          fonts,
          elements,
          decls,
        };
        const rawDir = path.join(o.out, "raw", raw.siteId);
        await fs.mkdir(rawDir, { recursive: true });
        let screenshotReady = false;
        try {
          await page.addStyleTag({
            content:
              "img,svg,video,canvas{visibility:hidden!important} *{background-image:none!important}",
          });
          screenshotReady = true;
        } catch (error) {
          (raw.warnings ||= []).push(
            `Screenshot style injection failed: ${error.message}`,
          );
        }
        if (screenshotReady) {
          await page.screenshot({
            path: path.join(rawDir, viewport.name + ".png"),
            fullPage: true,
            clip: {
              x: 0,
              y: 0,
              width: viewport.width,
              height: Math.min(
                10000,
                await page.evaluate(() =>
                  Math.max(innerHeight, document.documentElement.scrollHeight),
                ),
              ),
            },
          });
        }
        const cropDir = path.join(o.out, "crops", raw.siteId);
        await fs.mkdir(cropDir, { recursive: true });
        let cropStyleError;
        try {
          await page.addStyleTag({
            content:
              "*{color:transparent!important;text-shadow:none!important;box-shadow:none!important;background:transparent!important;border-color:transparent!important;outline:1px solid #777!important}",
          });
        } catch (error) {
          cropStyleError = `Crop style injection failed: ${error.message}`;
          (raw.warnings ||= []).push(cropStyleError);
        }
        const bounds = await page.evaluate(() => ({
          width: Math.min(innerWidth, document.documentElement.scrollWidth),
          height: Math.min(
            10000,
            Math.max(innerHeight, document.documentElement.scrollHeight),
          ),
        }));
        const cropResults = new Map();
        for (const d of decls)
          for (const s of d.samples) {
            const cropFile = path.join(cropDir, s.sid + ".png");
            const cached = cropResults.get(s.eid);
            s.crop = null;
            if (!screenshotReady || cropStyleError) {
              s.cropReason =
                cropStyleError || "Screenshot style injection failed";
              continue;
            }
            if (cached?.cropReason) {
              s.cropReason = cached.cropReason;
              continue;
            }
            const r = elements.find((e) => e.eid === s.eid).bbox;
            const x = Math.max(0, r[0]),
              y = Math.max(0, r[1]),
              width = Math.min(bounds.width, r[0] + r[2]) - x,
              height = Math.min(bounds.height, r[1] + r[3]) - y;
            if (width <= 0 || height <= 0) {
              s.cropReason = "bbox outside capture bounds (empty intersection)";
              cropResults.set(s.eid, { cropReason: s.cropReason });
              continue;
            }
            try {
              if (cached?.file) await fs.copyFile(cached.file, cropFile);
              else
                await page.screenshot({
                  path: cropFile,
                  fullPage: true,
                  clip: { x, y, width, height },
                });
              s.crop = `crops/${raw.siteId}/${s.sid}.png`;
              cropResults.set(s.eid, { file: cropFile });
            } catch (error) {
              s.cropReason = `crop capture failed: ${error.message}`;
              cropResults.set(s.eid, { cropReason: s.cropReason });
            }
          }
        validate("raw", raw);
        await writeJSON(path.join(rawDir, viewport.name + ".json"), raw);
        outputs.push(raw);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return outputs;
}
cli(import.meta.url, async (o) => ({
  ok: true,
  viewports: (await collect(o)).length,
}));
