import fs from "node:fs/promises";
import path from "node:path";
import { cli, readJSON, writeJSON } from "./lib/io.mjs";
import { color, deltaE } from "./lib/color.mjs";
import { spacingScale, typeScale, typeNames } from "./lib/scale.mjs";
import { validate } from "./lib/schema.mjs";
const alternatives = await readJSON(
  new URL("../data/font-alternatives.json", import.meta.url),
);
const category = (p) =>
  p === "max-width"
    ? "maxWidth"
    : p === "color" || p.endsWith("-color")
      ? "color"
      : p === "font-family"
        ? "fontFamily"
        : p === "font-size"
          ? "fontSize"
          : p === "font-weight"
            ? "fontWeight"
            : p === "line-height"
              ? "lineHeight"
              : p.includes("radius")
                ? "radius"
                : p === "box-shadow"
                  ? "shadow"
                  : /padding|margin|gap/.test(p)
                    ? "spacing"
                    : null;
const prefixes = {
  color: "c",
  fontFamily: "f",
  fontSize: "t",
  fontWeight: "w",
  lineHeight: "lh",
  radius: "r",
  shadow: "sh",
  spacing: "sp",
  maxWidth: "mw",
};
export function extractRaw(raws) {
  raws = [...raws].sort((a, b) =>
    a.viewport.name.localeCompare(b.viewport.name),
  );
  for (const r of raws) validate("raw", r);
  const first = raws[0],
    samples = {},
    buckets = {};
  for (const n of Object.keys(prefixes)) buckets[n] = [];
  for (const raw of raws)
    for (const d of raw.decls) {
      const split = d.key.indexOf("|"),
        property = d.key.slice(0, split),
        value = d.key.slice(split + 1),
        cat = category(property);
      if (!cat) continue;
      const es = d.samples.map((s) =>
        raw.elements.find((e) => e.eid === s.eid),
      );
      const parsed =
        cat === "color" ? color(value, es[0]?.parentBackground) : null;
      if (cat === "color" && !parsed) continue;
      if (cat === "shadow" && value === "none") continue;
      if (
        [
          "fontSize",
          "spacing",
          "radius",
          "lineHeight",
          "fontWeight",
          "maxWidth",
        ].includes(cat) &&
        !/^\d+(?:\.\d+)?(?:px)?$/.test(value)
      )
        continue;
      const weight =
        cat === "color" && property === "color"
          ? (d.textLen ?? es.reduce((sum, e) => sum + (e?.textLen || 0), 0))
          : d.area;
      const refs = [];
      for (const s of d.samples) {
        const e = raw.elements.find((e) => e.eid === s.eid);
        refs.push(s.sid);
        samples[s.sid] = {
          viewport: raw.viewport.name,
          selector: e.selector,
          property,
          value,
          authoredValue: s.authoredValue,
          stylesheet: s.stylesheet,
          line: s.line,
          column: s.column,
          origin: s.origin,
          bbox: e.bbox,
          crop:
            s.crop === undefined ? `crops/${raw.siteId}/${s.sid}.png` : s.crop,
          ...(s.cropReason ? { cropReason: s.cropReason } : {}),
          url: raw.url,
          collectedAt: raw.collectedAt,
          count: d.count,
          area: d.area,
        };
      }
      buckets[cat].push({
        value: parsed?.hex || value,
        composite: parsed?.composite || null,
        usage:
          property === "color"
            ? "text"
            : property === "background-color"
              ? "bg"
              : "border",
        count: d.count,
        area: d.area,
        weight,
        sampleRefs: refs,
      });
    }
  const spacing = spacingScale(buckets.spacing.map((c) => parseFloat(c.value)));
  const type = typeScale(buckets.fontSize.map((c) => parseFloat(c.value)));
  const outliers = [],
    clusters = {};
  for (const [cat, items] of Object.entries(buckets)) {
    items.sort((a, b) => b.weight - a.weight || a.value.localeCompare(b.value));
    const merged = [];
    for (const item of items) {
      if (
        (cat === "fontSize" && parseFloat(item.value) < 14) ||
        (cat === "spacing" &&
          parseFloat(item.value) > 0 &&
          Math.abs(
            parseFloat(item.value) / spacing.base -
              Math.round(parseFloat(item.value) / spacing.base),
          ) > 0.08)
      ) {
        outliers.push({ category: cat, value: item.value, count: item.count });
        continue;
      }
      let c = merged.find((c) =>
        cat === "color"
          ? deltaE(c.value, item.value) <= 2
          : c.value === item.value,
      );
      if (!c) {
        c = {
          ...item,
          members: [],
          sampleRefs: [],
          count: 0,
          area: 0,
          weight: 0,
        };
        merged.push(c);
      }
      if (!c.members.includes(item.value)) c.members.push(item.value);
      c.sampleRefs.push(...item.sampleRefs);
      c.count += item.count;
      c.area += item.area;
      c.weight += item.weight;
      if (item.composite) c.composite = item.composite;
    }
    if (cat !== "color")
      merged.sort(
        (a, b) =>
          parseFloat(a.value) - parseFloat(b.value) ||
          a.value.localeCompare(b.value),
      );
    const total = merged.reduce((s, c) => s + c.weight, 0) || 1;
    clusters[cat] = merged.map((c, i) => {
      const result = {
        id: prefixes[cat] + (i + 1),
        ...c,
        weight: c.weight / total,
        sampleRefs: [...new Set(c.sampleRefs)].sort(),
      };
      if (cat === "color")
        result.cssVar =
          raws
            .flatMap((r) => r.cssVars)
            .find((v) => color(v.value)?.hex === c.value)?.name || null;
      if (
        ["fontSize", "spacing", "radius", "lineHeight", "maxWidth"].includes(
          cat,
        )
      )
        result.px = parseFloat(c.value);
      if (cat === "spacing") result.outlier = false;
      if (cat === "fontFamily") {
        const name = c.value.split(",")[0].replace(/["']/g, "").trim();
        Object.assign(result, {
          name,
          ...(alternatives[name] || {
            openAlt: name,
            stack: c.value,
            licenseNote:
              "License not verified; use a system fallback until confirmed.",
          }),
        });
      }
      return result;
    });
  }
  const autoNames = {};
  for (const cat of ["spacing", "fontSize", "radius", "maxWidth"])
    autoNames[cat] = Object.fromEntries(
      clusters[cat].map((c, i) => [
        cat === "spacing"
          ? String(i + 1)
          : cat === "fontSize"
            ? ["sm", "base", "lg", "xl", "2xl"][i] || String(i)
            : ["sm", "md", "lg", "xl"][i] || String(i),
        c.id,
      ]),
    );
  autoNames.maxWidth = Object.fromEntries(
    clusters.maxWidth.map((c, i) => [String(i + 1), c.id]),
  );
  autoNames.fontSize = typeNames(clusters.fontSize, type.base);
  const componentCandidates = [];
  for (const raw of raws)
    for (const e of raw.elements) {
      const kind =
        e.tag === "button"
          ? "button"
          : e.tag === "input"
            ? "input"
            : e.tag === "section"
              ? "card"
              : null;
      if (!kind) continue;
      const styleRefs = {};
      for (const [p, v] of Object.entries(e.styles)) {
        const cat = category(p);
        const c = clusters[cat]?.find((c) =>
          cat === "color"
            ? color(v) && c.members.includes(color(v).hex)
            : c.value === v,
        );
        if (c) styleRefs[p] = c.id;
      }
      componentCandidates.push({
        id: `cmp${componentCandidates.length + 1}`,
        kind,
        viewport: raw.viewport.name,
        selector: e.selector,
        bbox: e.bbox,
        styleRefs,
      });
    }
  const result = {
    schemaVersion: 1,
    siteId: first.siteId,
    url: first.url,
    hasCssVars: raws.some((r) => r.cssVars.length > 0),
    clusters,
    scales: {
      spacingBase: spacing.base,
      spacingFit: spacing.fit,
      typeBase: type.base,
      typeRatio: type.ratio,
    },
    outliers,
    autoNames,
    componentCandidates,
    samples,
  };
  validate("evidence", result);
  return result;
}
export async function extract(o) {
  const raws = await Promise.all(
    (await fs.readdir(o.raw))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => readJSON(path.join(o.raw, f))),
  );
  const result = extractRaw(raws);
  await writeJSON(o.out, result);
  return result;
}
cli(import.meta.url, extract);
