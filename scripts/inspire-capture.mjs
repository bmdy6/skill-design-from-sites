import { navigateForCollection } from "./lib/navigation.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { converter } from "culori";
import { cli, readJSON, writeJSON, exists } from "./lib/io.mjs";
import { openBrowser } from "./lib/browser.mjs";
import { color } from "./lib/color.mjs";
const lightness = converter("oklab");
export function makeFingerprint(m) {
  const bg = color(m.background)?.hex || "#ffffff",
    bgL = lightness(bg).l,
    fontClass = { serif: 0, sans: 0, mono: 0, display: 0 };
  for (const f of m.fonts) {
    const c = /mono/i.test(f)
      ? "mono"
      : /sans|Arial|Helvetica/i.test(f)
        ? "sans"
        : /serif|Georgia|Times/i.test(f)
          ? "serif"
          : "display";
    fontClass[c]++;
  }
  for (const c of Object.keys(fontClass)) fontClass[c] /= m.fonts.length || 1;
  const positive = m.radii.filter((r) => r > 0).sort((a, b) => a - b);
  const palette = new Map();
  for (const c of m.colors) {
    const v = color(c.value);
    if (v) palette.set(v.hex, (palette.get(v.hex) || 0) + c.area);
  }
  const total = [...palette.values()].reduce((s, n) => s + n, 0) || 1,
    p = [...palette]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([hex, area]) => ({ hex, weight: area / total }));
  return {
    theme: bgL < 0.5 ? "dark" : "light",
    bgL,
    palette: p,
    accentChroma: Math.max(
      0,
      ...p.map((c) => Math.hypot(lightness(c.hex).a, lightness(c.hex).b)),
    ),
    fontClass,
    fontNames: [
      ...new Set(
        m.fonts.map((f) => f.split(",")[0].replace(/["']/g, "").trim()),
      ),
    ].sort(),
    basePx: m.basePx,
    headingRatio: m.headingPx / (m.basePx || 16),
    radiusPx: positive.length ? positive[Math.floor(positive.length / 2)] : 0,
    density: Math.min(1, m.textArea / (m.viewportArea || 1)),
    whitespace: Math.max(
      0,
      1 - Math.min(1, m.visibleArea / (m.viewportArea || 1)),
    ),
    imagery: Math.min(1, m.imageArea / (m.viewportArea || 1)),
    motion: { animations: m.animations, keyframes: m.keyframes },
    layout: m.layout,
  };
}
export async function measure(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll("body *")].filter((e) => {
      const r = e.getBoundingClientRect(),
        s = getComputedStyle(e);
      return (
        r.width > 1 &&
        r.height > 1 &&
        r.top < innerHeight &&
        r.bottom > 0 &&
        s.display !== "none" &&
        s.visibility !== "hidden"
      );
    });
    const colors = [],
      fonts = [],
      radii = [];
    let visibleArea = 0,
      textArea = 0,
      imageArea = 0;
    for (const e of els) {
      const s = getComputedStyle(e),
        r = e.getBoundingClientRect(),
        area = r.width * Math.min(r.height, innerHeight);
      colors.push({ value: s.backgroundColor, area });
      fonts.push(s.fontFamily);
      radii.push(parseFloat(s.borderTopLeftRadius) || 0);
      if (!e.children.length) {
        visibleArea += area;
        if (e.textContent.trim()) textArea += area;
      }
      if (
        ["IMG", "SVG", "VIDEO", "CANVAS"].includes(e.tagName) ||
        s.backgroundImage !== "none"
      )
        imageArea += area;
    }
    let keyframes = 0;
    for (const sheet of document.styleSheets)
      try {
        for (const rule of sheet.cssRules)
          if (rule.type === CSSRule.KEYFRAMES_RULE) keyframes++;
      } catch {}
    const main = document.querySelector("main") || document.body,
      style = getComputedStyle(main),
      body = getComputedStyle(document.body),
      h = document.querySelector("h1");
    let background = body.backgroundColor;
    if (background === "rgba(0, 0, 0, 0)")
      background = getComputedStyle(document.documentElement).backgroundColor;
    return {
      background,
      colors,
      fonts,
      radii,
      basePx: parseFloat(body.fontSize),
      headingPx: h
        ? parseFloat(getComputedStyle(h).fontSize)
        : parseFloat(body.fontSize),
      visibleArea,
      textArea,
      imageArea,
      viewportArea: innerWidth * innerHeight,
      animations: document.getAnimations().length,
      keyframes,
      layout:
        style.display === "grid"
          ? "grid"
          : style.display === "flex" && style.flexDirection === "row"
            ? "split"
            : /serif/.test(body.fontFamily) && !/sans/.test(body.fontFamily)
              ? "editorial"
              : "centered",
    };
  });
}
export async function capture(o) {
  const candidates =
      typeof o.candidates === "string"
        ? await readJSON(o.candidates)
        : o.candidates,
    cache = path.join(os.homedir(), ".cache/design-from-sites/shots");
  await fs.mkdir(cache, { recursive: true });
  const previous = (await exists(o.out))
    ? await readJSON(o.out)
    : { captures: [] };
  const captures = [],
    rejected = [];
  const { browser, info } = await openBrowser();
  try {
    for (const c of candidates.candidates) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        serviceWorkers: "block",
        acceptDownloads: false,
      });
      try {
        const page = await context.newPage();
        const response = await navigateForCollection(page, c.siteUrl, 15000);
        if (response && response.status() >= 400)
          throw Error(`HTTP ${response.status()}`);
        const text = await page.locator("body").innerText();
        const blocked =
          /just a moment|access denied|captcha|verify (?:that )?you are human|checking your browser|访问被拒绝|验证码|人机验证/i;
        if (blocked.test((await page.title()) + "\n" + text))
          throw Error("Blocked or challenge page");
        if (text.trim().length < 20) throw Error("Page too empty");
        const fp = makeFingerprint(await measure(page)),
          key = createHash("sha256").update(c.siteUrl).digest("hex"),
          shot = path.join(cache, key + ".jpg"),
          thumb = path.join(cache, key + ".webp");
        const jpeg = await page.screenshot({
          path: shot,
          type: "jpeg",
          quality: 80,
          fullPage: false,
        });
        const { webp, palette } = await page.evaluate(async (data) => {
          const image = new Image();
          image.src = "data:image/jpeg;base64," + data;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = 480;
          canvas.height = 300;
          canvas.getContext("2d").drawImage(image, 0, 0, 480, 300);
          const pixels = canvas
            .getContext("2d")
            .getImageData(0, 0, 480, 300).data;
          const counts = new Map();
          for (let i = 0; i < pixels.length; i += 4) {
            const hex =
              "#" +
              [pixels[i], pixels[i + 1], pixels[i + 2]]
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("");
            counts.set(hex, (counts.get(hex) || 0) + 1);
          }
          return {
            webp: canvas.toDataURL("image/webp", 0.75).split(",")[1],
            palette: [...counts]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([hex, count]) => ({ hex, weight: count / (480 * 300) })),
          };
        }, jpeg.toString("base64"));
        fp.palette = palette;
        if (fp.palette[0]?.weight > 0.95)
          throw Error(
            `Screenshot is essentially a single color (${fp.palette[0].weight})`,
          );
        await fs.writeFile(thumb, Buffer.from(webp, "base64"));
        captures.push({
          cid: c.cid,
          url: c.siteUrl,
          title: c.title || c.siteUrl,
          galleryUrl: c.galleryUrl || "",
          ok: true,
          thumb,
          shot,
          fp,
          browser: info,
        });
      } catch (e) {
        rejected.push({ cid: c.cid, reason: e.message.split("\n")[0] });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const r = {
    round: candidates.round || 1,
    currentCids: captures.map((c) => c.cid),
    captures: [
      ...previous.captures.filter(
        (p) => !candidates.candidates.some((c) => c.cid === p.cid),
      ),
      ...captures,
    ],
    rejected,
  };
  await writeJSON(o.out, r);
  return r;
}
cli(import.meta.url, capture);
