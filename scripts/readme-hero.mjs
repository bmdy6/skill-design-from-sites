// README hero image. Inputs are only original repository fixtures and the
// screenshots produced by scripts/screenshots.mjs; no external sites.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { cli, readJSON, writeJSON } from "./lib/io.mjs";
import { openBrowser } from "./lib/browser.mjs";
import { serve } from "../test/helpers/serve.mjs";

const run = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Labels a host agent would write for test/fixtures/site-a (IDs only, no values).
const FIXTURE_LABELS = {
  siteId: "a",
  color: { text: "c1", surface: "c2", border: "c3", accent: "c6", subtle: "c5" },
  fontFamily: { body: "f3" },
  shadow: { card: "sh1" },
  components: { card: "cmp1", button: "cmp2" },
  styleSummary: "Calm card layout with a blue accent.",
};

async function provenance() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-hero-"));
  const source = await serve(path.join(root, "test/fixtures"));
  try {
    const cmd = (...a) => run(process.execPath, [path.join(root, "scripts/run.mjs"), ...a], { cwd: root });
    await cmd("extract", "--url", source.url + "/site-a/", "--out", dir);
    await writeJSON(path.join(dir, "labels/a.json"), FIXTURE_LABELS);
    await cmd("tokens", "--out", dir);
    const sources = await readJSON(path.join(dir, "sources.json"));
    const verify = await readJSON(path.join(dir, "verify-report.json"));
    const pick = (k) => {
      const e = sources[k].evidence.find((x) => x.line != null) || sources[k].evidence[0];
      return { ...e, token: k, value: sources[k].value, stylesheet: path.basename(new URL(e.stylesheet).pathname) };
    };
    return { accent: pick("color.accent"), shadow: pick("shadow.card"), verify };
  } finally {
    await source.close();
  }
}

const img = async (f) =>
  "data:image/png;base64," + (await fs.readFile(path.join(root, "docs/screenshots", f))).toString("base64");

function html(p, shots) {
  const card = (e, shown) => `
    <div class="tok">
      <div class="row"><span class="name">${esc(e.token)}</span><span class="val">${shown}</span></div>
      <div class="src">← ${esc(e.stylesheet)}:${e.line}:${e.column}</div>
      <div class="code">${esc(e.selector)} {<br>&nbsp;&nbsp;${esc(e.property)}: ${esc(e.authoredValue || e.value)};<br>}</div>
    </div>`;
  const step = (n, title, sub, body) => `
    <section><div class="head"><b>${n}</b><div><h2>${title}</h2><p>${sub}</p></div></div><div class="panel">${body}</div></section>`;
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1600px;height:760px;background:#f3f1ec;font:16px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033;padding:44px 48px}
  .top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:28px}
  .top h1{font-size:30px;letter-spacing:-.01em}.top span{color:#5b6475;font-size:17px}
  main{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
  .head{display:flex;gap:12px;align-items:flex-start;height:74px}
  .head b{flex:none;width:30px;height:30px;border-radius:50%;background:#172033;color:#fff;display:grid;place-items:center;font-size:15px}
  h2{font-size:19px}.head p{color:#5b6475;font-size:14.5px}
  .panel{height:520px;border-radius:14px;overflow:hidden;background:#fff;border:1px solid #dcd8cf;box-shadow:0 6px 24px rgba(23,32,51,.08);position:relative}
  .shot{position:absolute;inset:0;background-repeat:no-repeat}
  .tok{margin:18px;padding:16px;border:1px solid #e3e6ec;border-radius:10px;font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
  .row{display:flex;justify-content:space-between;align-items:center;font-weight:600}
  .val{display:flex;align-items:center;gap:8px}.sw{width:18px;height:18px;border-radius:4px;display:inline-block;border:1px solid #0002}
  .src{color:#2564eb;margin:8px 0 6px}.code{color:#5b6475;background:#f6f7f9;border-radius:6px;padding:8px 10px}
  .ok{margin:6px 18px;color:#1a7f37;font:600 14px system-ui}
  .ba{position:absolute;left:0;right:0;height:50%;background-repeat:no-repeat;background-size:1090px auto}
  .ba i{position:absolute;left:12px;top:10px;font:600 12px system-ui;background:#172033;color:#fff;border-radius:99px;padding:2px 9px;font-style:normal}
  </style>
  <div class="top"><h1>From sites you love to a design you can trace</h1><span>original fixture output · no copied assets</span></div>
  <main>
  ${step(1, "Vote on references", "Mark what works: color, type, layout…",
    `<div class="shot" style="background-image:url(${shots.board});background-size:1152px auto;background-position:-44px -218px"></div>`)}
  ${step(2, "Tokens with receipts", "Every value points to a real CSS line",
    card(p.accent, `<i class="sw" style="background:${esc(p.accent.value)}"></i>${esc(p.accent.value)}`) +
    card(p.shadow, "0 4px 16px") +
    `<div class="ok">✓ re-opened page · ${p.verify.passed}/${p.verify.sampled} sources verified</div>`)}
  ${step(3, "Compare three layouts", "Structure first, then refine one",
    `<div class="shot" style="background-image:url(${shots.variants});background-size:1000px auto;background-position:-6px -42px"></div>`)}
  ${step(4, "Circle and revise", "Only the selected part changes",
    `<div class="ba" style="top:0;background-image:url(${shots.before});background-position:-6px -110px"><i>before</i></div>
     <div class="ba" style="top:50%;border-top:1px solid #dcd8cf;background-image:url(${shots.after});background-position:-6px -110px"><i>after</i></div>`)}
  </main>`;
}

export async function readmeHero(o) {
  const out = path.resolve(o.out || "docs/hero.png");
  const p = await provenance();
  const shots = {
    board: await img("inspiration-board.png"),
    variants: await img("variant-comparison.png"),
    before: await img("preview-before.png"),
    after: await img("preview-after.png"),
  };
  const { browser } = await openBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 760 }, deviceScaleFactor: 1.5 });
    await page.setContent(html(p, shots));
    await page.screenshot({ path: out });
  } finally {
    await browser.close();
  }
  return { out, accent: `${p.accent.stylesheet}:${p.accent.line}:${p.accent.column}`, verify: p.verify };
}

cli(import.meta.url, readmeHero);
