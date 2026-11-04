import { shadowValue } from "./lib/shadow.mjs";
import { checkTasteTokens } from "./lib/taste-check.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { cli, readJSON, writeJSON, write, fail } from "./lib/io.mjs";
import { validate } from "./lib/schema.mjs";
import { accessible, contrast } from "./lib/color.mjs";
export function flattenTokens(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? prefix + "." + k : k;
    if (v && typeof v === "object" && "$value" in v) out[p] = v;
    else if (v && typeof v === "object")
      Object.assign(out, flattenTokens(v, p));
  }
  return out;
}
export function buildTokens(evidence, labels, overrides = {}, options = {}) {
  for (const e of evidence) validate("evidence", e);
  for (const l of labels) {
    validate("labels", l);
    const e = evidence.find((e) => e.siteId === l.siteId);
    if (!e) fail("Label site is missing");
    for (const category of ["color", "fontFamily", "shadow", "components"])
      for (const id of Object.values(l[category] || {}))
        if (
          !(
            category === "components"
              ? e.componentCandidates
              : e.clusters[category]
          ).some((c) => c.id === id)
        )
          fail(`Unknown evidence ID ${l.siteId}:${id}`);
  }
  const siteScores = Object.fromEntries(
    evidence.map((e) => [
      e.siteId,
      {
        hasCssVars: e.hasCssVars,
        outlierRate:
          e.outliers.length /
          (Object.values(e.clusters).flat().length + e.outliers.length || 1),
      },
    ]),
  );
  const ranked = [...evidence].sort(
    (a, b) =>
      Number(b.hasCssVars) - Number(a.hasCssVars) ||
      siteScores[a.siteId].outlierRate - siteScores[b.siteId].outlierRate ||
      a.siteId.localeCompare(b.siteId),
  );
  const taste = options.taste;
  const reference = (role) => taste?.references?.find((r) => r.role === role);
  const resolve = (role) => {
    const ref = reference(role);
    if (!ref) return null;
    const e = evidence.find((e) => e.url === ref.url || e.siteId === ref.cid);
    if (!e) fail("Taste reference has not been collected: " + ref.url);
    return e;
  };
  const company = options.company;
  const baseline = company
    ? evidence.find((e) => e.siteId === "baseline")
    : null;
  if (company && !baseline) fail("Company baseline is required");
  if (company && resolve("primary") && resolve("primary") !== baseline)
    fail("External structural source is prohibited");
  for (const category of [
    "spacing",
    "fontSize",
    "radius",
    "structure",
    "maxWidth",
    "lineHeight",
    "fontWeight",
  ])
    if (company && overrides[category] && overrides[category] !== "baseline")
      fail("External structural override is prohibited");
  const primary = baseline || resolve("primary") || ranked[0];
  if (!primary) fail("No evidence");
  const tokens = {},
    sources = {},
    choices = [];
  const sourceSite = (category) => {
    const id =
      overrides[category] ||
      (category === "color"
        ? resolve("color")?.siteId
        : category === "fontFamily"
          ? resolve("type")?.siteId
          : null) ||
      primary.siteId;
    const e = evidence.find((e) => e.siteId === id);
    if (!e) fail(`Missing source site ${id}`);
    if (
      company &&
      e !== baseline &&
      !(company.allowedChanges || []).some(
        (a) =>
          a === category || (category === "color" && a.startsWith("color.")),
      )
    )
      fail("External category not allowed: " + category);
    return e;
  };
  const add = (category, name, c, e) => {
    tokens[category] ??= {};
    let type = "dimension",
      value = { value: c.px, unit: c.unit || "px" };
    if (category === "color") {
      type = "color";
      value = c.value;
    } else if (category === "fontFamily") {
      type = "fontFamily";
      value = c.value;
    } else if (category === "fontWeight") {
      type = "fontWeight";
      value = Number(c.value);
    } else if (category === "shadow") {
      type = "shadow";
      value = shadowValue(c.value);
    }
    tokens[category][name] = {
      $type: type,
      $value: value,
      $extensions: { dfs: { ref: `${e.siteId}:${c.id}` } },
    };
    sources[category + "." + name] = {
      site: e.siteId,
      cluster: c.id,
      value,
      confidence: c.cssVar
        ? "high"
        : c.sampleRefs.some((r) => e.samples[r]?.line)
          ? "medium"
          : "low",
      fromCssVar: c.cssVar || null,
      derived: null,
      evidence: c.sampleRefs.map((r) => structuredClone(e.samples[r])),
    };
  };
  for (const category of ["color", "fontFamily", "shadow"]) {
    const e = sourceSite(category);
    const l = labels.find((l) => l.siteId === e.siteId);
    if (!l) fail(`Missing labels ${e.siteId}`);
    for (const [name, id] of Object.entries(l[category] || {})) {
      let selected = e;
      let selectedId = id;
      if (category === "color") {
        const group = ["primary", "secondary", "accent", "brand"].includes(name)
          ? "color.brand"
          : "color.neutral";
        if (overrides[group]) {
          selected = evidence.find((s) => s.siteId === overrides[group]);
          if (!selected) fail("Missing source for " + group);
        }
        if (company && selected !== baseline) {
          const allowed = company.allowedChanges || [];
          if (
            !allowed.includes("color") &&
            !allowed.includes(group) &&
            !allowed.includes("color." + name)
          )
            selected = baseline;
        }
        selectedId = labels.find((s) => s.siteId === selected.siteId)?.color?.[
          name
        ];
        if (!selectedId)
          fail("Missing semantic label " + selected.siteId + ":" + name);
        choices.push({
          category: "color." + name,
          site: selected.siteId,
          reason: "Explicit role and permitted source category",
          conflicts: [],
        });
      }
      add(
        category,
        name,
        selected.clusters[category].find((c) => c.id === selectedId),
        selected,
      );
    }
    choices.push({
      category,
      site: e.siteId,
      reason: "Selected source with explicit evidence labels",
      conflicts: [],
    });
  }
  for (const category of ["spacing", "fontSize", "radius", "maxWidth"])
    for (const [name, id] of Object.entries(primary.autoNames[category] || {}))
      add(
        category,
        name,
        primary.clusters[category].find((c) => c.id === id),
        primary,
      );
  for (const category of ["lineHeight", "fontWeight"])
    for (const [i, c] of primary.clusters[category].entries())
      add(category, String(i + 1), c, primary);
  choices.unshift({
    category: "structure",
    site: primary.siteId,
    reason: "CSS variable availability, then lowest outlier rate",
    conflicts: [],
  });
  const contrastFixes = [];
  const bg = tokens.color?.surface?.$value;
  if (bg && !options.skipContrast)
    for (const name of ["text", "text-muted"]) {
      const t = tokens.color[name];
      if (!t) continue;
      const before = contrast(t.$value, bg);
      const fixed = accessible(t.$value, bg);
      if (fixed.derived) {
        contrastFixes.push({
          token: "color." + name,
          against: "color.surface",
          before,
          after: contrast(fixed.value, bg),
          from: t.$value,
          to: fixed.value,
        });
        t.$value = fixed.value;
        sources["color." + name].value = fixed.value;
        sources["color." + name].derived = fixed.derived;
      }
    }
  for (const c of choices)
    c.basis = [
      {
        kind: company ? "baseline" : "taste",
        ref: company ? "baseline" : c.site,
      },
      ...(company ? [{ kind: "grill", ref: "allowedChanges" }] : []),
    ];
  if (taste)
    for (const c of choices)
      c.reason +=
        "; taste reference / axes: " + Object.keys(taste.axes).join(", ");
  if (company)
    for (const record of Object.values(sources)) {
      record.basis = [
        { kind: "baseline", ref: "baseline" },
        { kind: "grill", ref: "allowedChanges" },
      ];
      if (record.site !== "baseline")
        for (const e of record.evidence) e.crop = null;
    }
  const report = {
    primarySite: primary.siteId,
    siteScores,
    choices,
    contrastFixes,
    tasteCheck: taste ? checkTasteTokens(taste, tokens) : null,
  };
  validate("sources", sources);
  validate("merge-report", report);
  return { tokens, sources, report };
}
export async function build(o) {
  const loadDir = async (d) =>
    Promise.all(
      (await fs.readdir(d))
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => readJSON(path.join(d, f))),
    );
  const r = buildTokens(
    await loadDir(o.evidence),
    await loadDir(o.labels),
    o.overrides ? await readJSON(o.overrides) : {},
    {
      taste: o.taste ? await readJSON(o.taste) : null,
      company: o.brief ? (await readJSON(o.brief)).company : null,
    },
  );
  await writeJSON(path.join(o.out, "tokens.json"), r.tokens);
  await writeJSON(path.join(o.out, "sources.json"), r.sources);
  await writeJSON(path.join(o.out, "merge-report.json"), r.report);
  await write(
    path.join(o.out, "merge-report.md"),
    `# Merge report\n\nPrimary: ${r.report.primarySite}\n\n` +
      r.report.choices
        .map((c) => `- ${c.category}: ${c.site} — ${c.reason}`)
        .join("\n") +
      "\n",
  );
  const tasteCheck = r.report.tasteCheck;
  if (tasteCheck?.status === "insufficient")
    console.warn("Warning: insufficient taste evidence; tokens build continues.");
  const ok = !tasteCheck?.violations.length;
  if (!ok) process.exitCode = 1;
  return {
    ok,
    tokens: Object.keys(r.sources).length,
  };
}
cli(import.meta.url, build);
