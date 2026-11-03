import fs from "node:fs/promises";
import path from "node:path";
import { cli, readJSON, writeJSON, write, exists, fail } from "./lib/io.mjs";
import { variable, checkText } from "./check.mjs";
import { flattenTokens } from "./build-tokens.mjs";
import { prepare } from "./preview-prepare.mjs";
import { tasteCheck } from "./taste-check.mjs";
import { requireGate, pendingGate } from "./lib/gates.mjs";
export function variantHTML(tokens, layout, wire = false) {
  const flat = flattenTokens(tokens);
  const pick = (cat, fallback) => {
    const name = Object.keys(flat).find((p) => p.startsWith(cat + "."));
    return name ? `var(${variable(name)})` : fallback;
  };
  const sp = pick("spacing", "0"),
    size = pick("fontSize", "inherit"),
    radius = pick("radius", "0"),
    surface = "var(--color-surface)",
    text = "var(--color-text)",
    accent = wire ? text : "var(--color-primary)";
  const arrangements = {
    centered:
      "main{text-align:center} section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}",
    split:
      "main{display:grid;grid-template-columns:1fr 1fr} header{grid-row:span 2} section{display:grid}",
    editorial:
      "main{display:block} header{text-align:left} section{display:grid;grid-template-columns:2fr 1fr 1fr}",
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${wire ? "Wireframe" : "Design direction — " + layout}</title><link rel="stylesheet" href="../tokens.css"><style>body{margin:0;background:${surface};color:${text};font-family:${pick("fontFamily", "inherit")};font-size:${size}} main{padding:${sp};gap:${sp}}header,article,section{padding:${sp};gap:${sp}}article{border:solid currentColor;border-radius:${radius}}button{background:${accent};color:${surface};padding:${sp};border:0;border-radius:${radius}}${arrangements[layout]} @media(max-width:600px){main,section{display:block!important}}</style></head><body><main><header><p>${wire ? "POSITION & PURPOSE" : "MADE FOR YOUR NEXT CHAPTER"}</p><h1>${wire ? "Headline placeholder" : "Make room for better work."}</h1><p>${wire ? "Supporting message" : "A thoughtful space to focus, create and move forward."}</p><button>${wire ? "Primary action" : "Start something meaningful"}</button></header><section><article><h2>${wire ? "Feature area" : "A clear beginning"}</h2><p>Find a rhythm that works for you.</p></article><article><h2>${wire ? "Feature area" : "Space to think"}</h2><p>Keep the essentials close.</p></article><article><h2>${wire ? "Feature area" : "A steady pace"}</h2><p>Make progress one choice at a time.</p></article></section></main></body></html>`;
}
export async function variants(o) {
  const run = o.run || ".design-from-sites",
    file = path.join(run, "variants.json"),
    state = (await exists(file))
      ? await readJSON(file)
      : {
          wire: { file: "preview/wire.html", approved: false },
          variants: [],
          picked: null,
          hifi: { file: null, approved: false },
        };
  const brief = (await exists(path.join(run, "brief.json")))
    ? await readJSON(path.join(run, "brief.json"))
    : null;
  const company = brief?.mode === "company";
  if (company && o["skip-wire"]) fail("Company wireframe cannot be skipped");
  const basis = company
    ? [
        { kind: "grill", ref: "goal" },
        { kind: "baseline", ref: "baseline" },
      ]
    : [{ kind: "taste", ref: "references" }];
  const approver = (gate) =>
    company && brief.company.approvers.includes(gate) ? "boss" : "user";
  const stage = o.stage || "wire";
  const save = () => writeJSON(file, state);
  if (stage === "hifi") {
    if (!state.picked) {
      await pendingGate(
        run,
        "variant",
        "Choose a direction before high fidelity.",
        state.variants.map((v) => v.id),
        approver("variant"),
      );
      fail("No variant picked", 3);
    }
    await requireGate(
      run,
      "variant",
      "Confirm the selected direction.",
      state.variants.map((v) => v.id),
      approver("variant"),
    );
    const selected = state.variants.find((v) => v.id === state.picked);
    if (!selected) fail("Unknown selected variant");
    state.hifi = { file: "preview/hifi.html", approved: false, basis };
    await write(
      path.join(run, state.hifi.file),
      await fs.readFile(path.join(run, selected.file), "utf8"),
    );
    await save();
    return pendingGate(
      run,
      "hifi",
      "Approve the final draft before build.",
      ["approve", "revise"],
      approver("hifi"),
    );
  }
  if (stage === "pick") {
    if (!state.variants.some((v) => v.id === o.pick)) fail("Unknown variant");
    state.picked = o.pick;
    await save();
    return pendingGate(run, "variant", "Confirm the selected direction.", [
      "approve",
      "revise",
    ]);
  }
  const tokens = await readJSON(path.join(run, "tokens.json"));
  if (stage === "wire") {
    state.wire.basis = basis;
    await write(
      path.join(run, state.wire.file),
      variantHTML(tokens, "centered", true),
    );
    const prepared = await prepare({
      file: path.join(run, state.wire.file),
      "tokens-css": path.join(run, "tokens.css"),
    });
    if (!prepared.ok) fail("Wireframe has hardcoded values", 1);
    await save();
    return pendingGate(
      run,
      "wire",
      "Approve the page structure.",
      ["approve", "revise"],
      approver("wire"),
    );
  }
  if (stage !== "variants") fail("Expected wire, variants, pick or hifi");
  if (!o["skip-wire"])
    await requireGate(
      run,
      "wire",
      "Approve page structure.",
      ["approve", "revise"],
      approver("wire"),
    );
  state.wire.approved = !o["skip-wire"];
  state.variants = [];
  for (const [i, layout] of ["centered", "split", "editorial"].entries()) {
    const id = "v" + (i + 1),
      file = "preview/" + id + ".html";
    const html = variantHTML(tokens, layout);
    await write(path.join(run, file), html);
    const p = await prepare({
      file: path.join(run, file),
      "tokens-css": path.join(run, "tokens.css"),
    });
    const taste = o.taste
      ? await tasteCheck({
          taste: o.taste,
          html: path.join(run, file),
          root: run,
        })
      : { ok: true, score: 1 };
    state.variants.push({
      id,
      file,
      layout,
      rationale: "Original " + layout + " arrangement using selected tokens",
      tasteScore: taste.score,
      check: p.findings.length,
      basis,
    });
    await save();
    if (!p.ok || !taste.ok) fail("Draft checks failed", 1);
  }
  await write(path.join(run, "preview/compare.html"), comparisonHTML(state));
  return pendingGate(
    run,
    "variant",
    "Choose a layout to refine.",
    state.variants.map((v) => v.id),
    approver("variant"),
  );
}
cli(import.meta.url, variants);

export function comparisonHTML(state) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Compare directions</title><link rel="stylesheet" href="../tokens.css"><style>body{margin:0;padding:var(--spacing-3);background:var(--color-surface);color:var(--color-text);font-family:var(--font-family-body)}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--spacing-3)}iframe{width:100%;height:75vh;border:0}article{border:solid currentColor;padding:var(--spacing-1)}a{color:var(--color-primary)}@media(max-width:600px){main{display:block}}</style></head><body><header><p>THREE ORIGINAL DIRECTIONS</p><h1>Choose the arrangement that fits.</h1><p>Compare structure first. Reply with the direction to refine.</p></header><main>${state.variants.map((v) => `<article><h2>${v.id} · ${v.layout}</h2><p>${v.rationale}</p><a href="${path.basename(v.file)}">Open this direction ↗</a><iframe title="${v.id} ${v.layout}" src="${path.basename(v.file)}" sandbox="allow-same-origin"></iframe></article>`).join("")}</main></body></html>`;
}
