// README artwork: banner, hero (light/dark) and workflow strip.
// Inputs are only original repository fixtures, a real extraction of
// test/fixtures/site-a, and the screenshots from scripts/screenshots.mjs.
// No external sites, no third-party images. Fonts are rasterised locally.
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
const HERO_TOKENS = ["color.accent", "color.text", "color.border", "fontSize.xl", "radius.lg", "shadow.card"];

const THEMES = {
  light: {
    bg: "#ffffff", bg2: "#f4f6fb", dot: "#e3e7f0", win: "#ffffff", line: "#e4e7ee", bar: "#f7f8fa",
    text: "#172033", mute: "#667085", code: "#344054", num: "#a0a8b8", hl: "#eef4ff", hlStrong: "#dbe7ff",
    accent: "#2563eb", ok: "#1a7f37", okBg: "#e9f7ee", shadow: "0 1px 2px rgba(16,24,40,.06), 0 12px 32px rgba(16,24,40,.10)",
  },
  dark: {
    bg: "#0d1117", bg2: "#111826", dot: "#1c2433", win: "#151b26", line: "#262f3e", bar: "#1a2130",
    text: "#e6edf3", mute: "#8b949e", code: "#c9d1d9", num: "#545d6b", hl: "#162340", hlStrong: "#1d3263",
    accent: "#5b8cff", ok: "#3fb950", okBg: "#12261a", shadow: "0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.45)",
  },
};
const FONTS = `font-family:Inter,"Inter Tight",system-ui,sans-serif`;
const MONO = `font-family:"JetBrains Mono","IBM Plex Mono",ui-monospace,monospace`;

async function extraction() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-art-"));
  const source = await serve(path.join(root, "test/fixtures"));
  try {
    const cmd = (...a) => run(process.execPath, [path.join(root, "scripts/run.mjs"), ...a], { cwd: root });
    await cmd("extract", "--url", source.url + "/site-a/", "--out", dir);
    await writeJSON(path.join(dir, "labels/a.json"), FIXTURE_LABELS);
    await cmd("tokens", "--out", dir);
    const sources = await readJSON(path.join(dir, "sources.json"));
    const verify = await readJSON(path.join(dir, "verify-report.json"));
    const rows = HERO_TOKENS.map((k) => {
      const e = sources[k].evidence.find((x) => x.line != null);
      if (!e) throw Error("no line for " + k);
      return { token: k, value: sources[k].value, file: path.basename(new URL(e.stylesheet).pathname), line: e.line, column: e.column };
    });
    const css = (await fs.readFile(path.join(root, "test/fixtures/site-a/main.css"), "utf8")).split("\n");
    return { rows, css, verify, total: Object.keys(sources).length };
  } finally {
    await source.close();
  }
}

const shown = (v) => {
  if (typeof v === "string") return v;
  if (v && "offsetY" in v) return `0 ${v.offsetY.value}px ${v.blur.value}px`;
  if (v && "value" in v) return v.value + v.unit;
  return String(v);
};
function visual(r, t) {
  const v = shown(r.value);
  if (r.token.startsWith("color.")) return `<i class="sw" style="background:${esc(v)}"></i>`;
  if (r.token.startsWith("radius.")) return `<i class="sw rad" style="border-radius:${esc(v)}"></i>`;
  if (r.token.startsWith("shadow.")) return `<i class="sw shd"></i>`;
  if (r.token.startsWith("fontSize.")) return `<i class="sw aa">Aa</i>`;
  return `<i class="sw"></i>`;
}

function base(t, w, h) {
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:${w}px;height:${h}px;${FONTS};color:${t.text};background:${t.bg};overflow:hidden;-webkit-font-smoothing:antialiased;position:relative}
  body::before{content:"";position:absolute;inset:0;background-image:radial-gradient(${t.dot} 1px,transparent 1px);background-size:22px 22px;
    -webkit-mask-image:radial-gradient(ellipse 60% 70% at 50% 50%,#000 40%,transparent 100%)}
  .win{position:absolute;background:${t.win};border:1px solid ${t.line};border-radius:16px;box-shadow:${t.shadow};overflow:hidden}
  .bar{height:46px;display:flex;align-items:center;gap:8px;padding:0 18px;background:${t.bar};border-bottom:1px solid ${t.line};${MONO};font-size:14px;color:${t.mute}}
  .bar b{width:11px;height:11px;border-radius:50%;background:${t.line}}
  .bar span{margin-left:10px;color:${t.text};font-weight:600}.bar em{margin-left:auto;font-style:normal}
  </style>`;
}

function hero(t, d) {
  const lines = d.css.slice(6, 15); // lines 7..15
  const used = new Set(d.rows.map((r) => r.line));
  return `${base(t, 1200, 500)}<style>
  .rows{padding:10px 0}
  .row{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:14px;height:54px;padding:0 22px;border-bottom:1px solid ${t.line}}
  .row:last-child{border-bottom:0}.row.on{background:${t.hl}}
  .sw{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;border:1px solid ${t.num};font-style:normal}
  .rad{border:3px solid ${t.accent};background:transparent}.shd{background:${t.win};box-shadow:0 4px 12px rgba(0,0,0,.25)}
  .aa{font:700 17px Inter;color:${t.text}}
  .nm{${MONO};font-size:16px;font-weight:600}.vl{${MONO};font-size:14px;color:${t.mute};margin-top:2px}
  .chip{${MONO};font-size:13.5px;color:${t.accent};background:${t.hl};border:1px solid ${t.hlStrong};padding:5px 10px;border-radius:999px}
  .row.on .chip{background:${t.accent};color:#fff;border-color:${t.accent}}
  .code{padding:10px 0;${MONO};font-size:14.5px;line-height:34px;color:${t.code}}
  .ln{display:grid;grid-template-columns:46px 1fr;padding-right:18px;white-space:pre;overflow:hidden}
  .ln i{font-style:normal;text-align:right;padding-right:16px;color:${t.num}}
  .ln.use{background:${t.hl}}.ln.on{background:${t.hlStrong}}.ln.on i{color:${t.accent};font-weight:700}
  svg{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
  .foot{position:absolute;left:0;right:0;bottom:22px;display:flex;justify-content:center}
  .pill{display:flex;gap:10px;align-items:center;padding:10px 18px;border-radius:999px;background:${t.okBg};color:${t.ok};font-weight:600;font-size:16px;border:1px solid ${t.line}}
  </style>
  <div class="win" style="left:40px;top:34px;width:500px">
    <div class="bar"><b></b><b></b><b></b><span>tokens.json</span><em>${d.rows.length} of ${d.total}</em></div>
    <div class="rows">${d.rows
      .map((r, i) => `<div class="row${i ? "" : " on"}" data-line="${r.line}">${visual(r, t)}<div><div class="nm">${esc(r.token)}</div><div class="vl">${esc(shown(r.value))}</div></div><span class="chip">${esc(r.file)}:${r.line}</span></div>`)
      .join("")}</div>
  </div>
  <div class="win" style="left:640px;top:34px;width:520px">
    <div class="bar"><b></b><b></b><b></b><span>main.css</span><em>source</em></div>
    <div class="code">${lines
      .map((l, i) => {
        const n = i + 7, cls = n === d.rows[0].line ? " on" : used.has(n) ? " use" : "";
        return `<div class="ln${cls}" data-n="${n}"><i>${n}</i>${esc(l.length > 52 ? l.slice(0, 51) + "…" : l)}</div>`;
      })
      .join("")}</div>
  </div>
  <svg id="wires" width="1200" height="500"></svg>
  <div class="foot"><div class="pill">✓ Page reopened · ${d.verify.passed}/${d.verify.sampled} sampled sources still match</div></div>
  <script>
    const svg = document.getElementById("wires"), seen = new Set();
    for (const row of [...document.querySelectorAll(".row")].reverse()) {
      const n = row.dataset.line, chip = row.querySelector(".chip").getBoundingClientRect();
      const ln = document.querySelector('.ln[data-n="' + n + '"]').getBoundingClientRect();
      const on = row.classList.contains("on");
      const x1 = chip.right + 6, y1 = chip.top + chip.height / 2, x2 = ln.left - 2, y2 = ln.top + ln.height / 2;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M" + x1 + "," + y1 + " C" + (x1 + 60) + "," + y1 + " " + (x2 - 60) + "," + y2 + " " + x2 + "," + y2);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "${t.accent}");
      p.setAttribute("stroke-width", on ? 2.5 : 1.4);
      p.setAttribute("stroke-opacity", on ? 1 : 0.35);
      if (!on) p.setAttribute("stroke-dasharray", "4 5");
      svg.appendChild(p);
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", x2); c.setAttribute("cy", y2); c.setAttribute("r", on ? 4.5 : 3);
      c.setAttribute("fill", "${t.accent}"); c.setAttribute("fill-opacity", on ? 1 : 0.5);
      svg.appendChild(c);
    }
  </script>`;
}

function banner(t, d) {
  const sw = d.rows.filter((r) => r.token.startsWith("color."));
  return `${base(t, 1200, 220)}<style>
  body{display:grid;place-items:center}body::before{display:none}
  .wrap{text-align:center}
  h1{font:800 76px/1 "Inter Tight",Inter,sans-serif;letter-spacing:-.035em}
  h1 em{font:italic 400 84px/1 "Instrument Serif",serif;letter-spacing:-.01em;color:${t.accent};padding:0 .06em}
  .chips{display:flex;gap:10px;justify-content:center;margin-top:26px}
  .c{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border:1px solid ${t.line};border-radius:999px;background:${t.win};${MONO};font-size:13px;color:${t.mute}}
  .c i{width:22px;height:22px;border-radius:50%;border:1px solid ${t.line}}
  </style><div class="wrap"><h1>design<em>from</em>sites</h1>
  <div class="chips">${sw.map((r) => `<span class="c"><i style="background:${esc(r.value)}"></i>${esc(r.value)} ← ${esc(r.file)}:${r.line}</span>`).join("")}</div></div>`;
}

async function workflow(t) {
  const img = async (f) =>
    "data:image/png;base64," + (await fs.readFile(path.join(root, "docs/screenshots", f))).toString("base64");
  const board = await img("inspiration-board.png"), variants = await img("variant-comparison.png");
  const before = await img("preview-before.png"), after = await img("preview-after.png");
  // crop(x, y, w, h) of a 1440-wide screenshot, scaled to `width` px
  const crop = (src, x, y, w, h, width, extra = "") => {
    const s = width / w;
    return `<div class="crop" style="width:${width}px;height:${Math.round(h * s)}px;background-image:url(${src});background-size:${1440 * s}px auto;background-position:${-x * s}px ${-y * s}px;${extra}"></div>`;
  };
  const tag = (text) => `<span class="tag">${text}</span>`;
  return `${base(t, 1200, 410)}<style>
  body::before{display:none}
  main{position:absolute;inset:34px 40px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .step{background:${t.win};border:1px solid ${t.line};border-radius:16px;box-shadow:${t.shadow};padding:22px;display:flex;flex-direction:column;gap:14px}
  .h{display:flex;gap:12px;align-items:center}.h b{width:30px;height:30px;border-radius:50%;background:${t.text};color:${t.bg};display:grid;place-items:center;font-size:15px}
  .h h2{font:700 22px "Inter Tight",Inter;letter-spacing:-.01em}.p{color:${t.mute};font-size:15.5px;line-height:1.45}
  .crop{border-radius:10px;border:1px solid ${t.line};background-repeat:no-repeat;position:relative}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.col{display:flex;flex-direction:column;gap:8px}
  .tag{position:absolute;left:8px;top:8px;font:600 12px Inter;padding:3px 9px;border-radius:999px;background:${t.text};color:${t.bg}}
  .vote{display:flex;gap:6px;justify-content:center}.vote span{font:600 12.5px Inter;padding:4px 10px;border-radius:7px;border:1px solid ${t.line}}
  .vote span:first-child{background:${t.text};color:${t.bg};border-color:${t.text}}
  .lab{font:600 12.5px ${MONO.replace("font-family:", "")};color:${t.mute};text-align:center}
  </style><main>
  <section class="step"><div class="h"><b>1</b><h2>Vote on references</h2></div>
    <div class="p">Like what works — color, type, layout, whitespace. Taste is settled before anything is extracted.</div>
    <div class="grid">${[73, 513, 953].map((x) => `<div class="col">${crop(board, x, 293, 414, 258, 101)}<div class="vote"><span>Like</span></div></div>`).join("")}</div>
  </section>
  <section class="step"><div class="h"><b>2</b><h2>Compare three layouts</h2></div>
    <div class="p">Same tokens, three structures. Pick one; nothing is built until you say yes.</div>
    <div class="col">${[["centered", 27], ["split", 502], ["editorial", 976]].map(([n, x]) => `<div style="display:grid;grid-template-columns:78px 1fr;align-items:center;gap:8px"><div class="lab">${n}</div>${crop(variants, x, 298, 440, 110, 234)}</div>`).join("")}</div>
  </section>
  <section class="step"><div class="h"><b>3</b><h2>Circle and revise</h2></div>
    <div class="p">Mark one part. Only that subtree changes; the rest is hash-checked.</div>
    <div class="col">${crop(before, 14, 205, 470, 135, 318, "")}${crop(after, 14, 205, 470, 135, 318)}</div>
  </section></main>
  <script>document.querySelectorAll(".step:nth-child(3) .crop").forEach((c,i)=>c.insertAdjacentHTML("beforeend",'${tag("before")}'.replace("before", i ? "after" : "before")))</script>`;
}

export async function readmeArt(o) {
  const out = path.resolve(o.out || "docs/readme");
  await fs.mkdir(out, { recursive: true });
  const d = await extraction();
  const { browser } = await openBrowser();
  const shots = [];
  try {
    const shoot = async (name, html, w, h) => {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      await page.setContent(html);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, name) });
      await page.close();
      shots.push(name);
    };
    for (const [k, t] of Object.entries(THEMES)) {
      await shoot(`banner-${k}.png`, banner(t, d), 1200, 220);
      await shoot(`hero-${k}.png`, hero(t, d), 1200, 500);
      await shoot(`workflow-${k}.png`, await workflow(t), 1200, 410);
    }
  } finally {
    await browser.close();
  }
  return { out, shots, verify: d.verify, rows: d.rows.map((r) => `${r.token} ← ${r.file}:${r.line}:${r.column}`) };
}

cli(import.meta.url, readmeArt);
