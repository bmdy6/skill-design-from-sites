// Purpose-made README artwork. No network assets or raw tool screenshots.
// Only the provenance hero uses test evidence; all site demos are fictional.
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
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;"})[c]);
const FIXTURE_LABELS = {
  siteId: "a", color: { text: "c1", surface: "c2", border: "c3", accent: "c6", subtle: "c5" },
  fontFamily: { body: "f3" }, shadow: { card: "sh1" }, components: { card: "cmp1", button: "cmp2" },
  styleSummary: "Calm card layout with a blue accent.",
};
const HERO_TOKENS = ["color.accent", "color.text", "color.border"];
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
      return { token: k, value: sources[k].value, selector: e.selector, file: path.basename(new URL(e.stylesheet).pathname), line: e.line, column: e.column };
    });
    const css = (await fs.readFile(path.join(root, "test/fixtures/site-a/main.css"), "utf8")).split("\n");
    return { rows, css, verify, total: Object.keys(sources).length };
  } finally {
    await source.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
}


const words = {
  en: { journal: 'Morrowleaf', saas: 'Kiveloop', craft: 'Emberkiln', dev: 'Noxbranch',
    issue: 'FIELD NOTES / VOL. 08', story: 'A slower kind of Sunday.', sub: 'Stories for a life well noticed.', read: 'Read the journal →',
    plan: 'Less chasing. More making.', planSub: 'A clear home for your next big idea.', start: 'Plan your week →',
    shop: 'Made slowly. Held daily.', shopSub: 'Small-batch stoneware, shaped by hand.', browse: 'Explore the collection →',
    ship: 'Ship with a quiet mind.', shipSub: 'One terminal. Every environment.', terminal: '3 checks passed · ready to deploy',
    selected: '♥ Keep', vote: 'Vote', compare: 'Compare', revise: 'Revise',
    voteCap: 'Keep the details you love.', compareCap: 'Choose a filled layout.', reviseCap: 'Mark one part. Refine it.',
    source: 'SOURCE', verified: 'Live extraction · selector + CSS line verified',
    output: 'A system you can build with.', outputSub: 'Measured values. Clear rules. A page with character.',
    rules: 'Design direction', rule1: 'Warm paper, ink-black type.', rule2: 'Serif headlines; open spacing.', rule3: 'Terracotta for the next action.',
    page: 'Rendered page', demo: 'Fictional demo · illustrative output', samples: 'Four references. Four distinct voices.',
    samplesSub: 'Original demo sites, made for this walkthrough.', centered: 'Centered', split: 'Split', editorial: 'Editorial',
    before: 'Before', after: 'After', note: 'Give the story more room.', color: 'Warm palette', type: 'Serif type',
  },
  zh: { journal: '叶间志', saas: '序环', craft: '余温陶社', dev: '夜枝',
    issue: '田野手记 / 第八期', story: '把周日，过得慢一点。', sub: '记录日常里，值得留意的小事。', read: '翻开这一期 →',
    plan: '少些追赶，多些创造。', planSub: '让下一个好想法，有条理地发生。', start: '安排这一周 →',
    shop: '慢慢做，日日用。', shopSub: '手工塑形，小批烧制的日用陶器。', browse: '看看本季作品 →',
    ship: '从容交付，安心收工。', shipSub: '一个终端，掌握每个运行环境。', terminal: '三项检查通过 · 可以发布',
    selected: '♥ 喜欢', vote: '投票', compare: '对比', revise: '修改',
    voteCap: '留下喜欢的设计细节。', compareCap: '选一个有真实内容的布局。', reviseCap: '圈出一处，再细化。',
    source: '来源', verified: '真实采集 · 已核对选择器与样式行号',
    output: '拿到就能用的设计体系。', outputSub: '实测数值、清晰规范，还有一张有风格的页面。',
    rules: '设计方向', rule1: '暖纸色底，墨黑色正文。', rule2: '衬线标题，舒展的间距。', rule3: '用陶土色突出下一步操作。',
    page: '页面效果', demo: '虚构演示 · 产物示意', samples: '四个参考站，四种鲜明风格。',
    samplesSub: '为这次演示原创的站点与内容。', centered: '居中', split: '分栏', editorial: '杂志',
    before: '修改前', after: '修改后', note: '让文章标题更舒展。', color: '温暖配色', type: '衬线字体',
  },
};

function base(theme, lang) {
  const dark = theme === 'dark';
  return `<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><meta charset="utf-8"><style>
  :root{--bg:${dark ? '#121819' : '#f3f3ed'};--panel:${dark ? '#1b2425' : '#fffefa'};--ink:${dark ? '#eef1e6' : '#24312c'};--muted:${dark ? '#b0bdb6' : '#59685e'};--line:${dark ? '#3d4a43' : '#d6dcd2'};--accent:${dark ? '#c8de9b' : '#36583a'}}
  *{box-sizing:border-box}body{margin:0;width:900px;background:var(--bg);color:var(--ink);font:16px/1.5 Arial,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
  main{padding:26px}h1,h2,h3,p{margin:0}h1{font-size:30px;line-height:1.2;letter-spacing:-.6px}h2{font-size:21px;line-height:1.3}h3{font-size:17px}small{font-size:13px}p{color:var(--muted)}
  header{margin-bottom:22px}header p{margin-top:6px} .grid{display:grid;gap:14px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;min-width:0}
  .bar{padding:12px 14px;border-bottom:1px solid var(--line);font-size:15px;font-weight:700;display:flex;justify-content:space-between;align-items:center}.pad{padding:16px}
  code,pre{font-family:ui-monospace,Menlo,Consolas,monospace}pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.85} .accent{color:var(--accent)} .tag{display:inline-block;padding:4px 9px;background:var(--accent);color:var(--bg);border-radius:5px;font-size:13px;font-weight:700}
  footer{margin-top:16px;font-size:14px;color:var(--muted)} .site{padding:20px;position:relative;overflow:hidden;color:#292b23;background:#f5f0e4}.site p{color:inherit}.site nav{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid currentColor;padding-bottom:10px;margin-bottom:18px;font-size:14px}.brand{font-weight:800;font-size:19px;letter-spacing:-.5px}.site h2{font:normal 34px/1.12 Georgia,"Songti SC",serif;letter-spacing:-.5px;margin:10px 0}.site p{font-size:15px}.cta{display:inline-block;margin-top:18px;padding:9px 13px;background:#a34f36;color:#fff9ef;font-size:14px;font-weight:700}
  .landscape{height:94px;position:relative;background:#c8d0ae;overflow:hidden;margin-top:18px}.landscape:before{content:"";position:absolute;width:300px;height:170px;border-radius:50%;background:#818c68;transform:rotate(-18deg);top:45px;left:-55px}.landscape:after{content:"";position:absolute;width:270px;height:160px;border-radius:50%;background:#4e6755;top:56px;left:120px}
  .saas{background:#e5ef67;color:#172724}.saas h2{font-family:Arial,"PingFang SC",sans-serif;font-weight:900;font-size:38px;letter-spacing:-1.6px}.saas .cta{background:#172724;color:#f0f5b9}.tasks{margin-top:18px;background:#fffef2;color:#172724;padding:12px;font-size:14px}.task{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #cdd4b5}.task:last-child{border:0}
  .craft{background:#eee0cb;color:#613f2c}.craft .cta{background:#784a34}.pottery{display:flex;gap:16px;margin-top:18px;background:#d1b79a;height:94px;align-items:center;justify-content:center}.pot{width:66px;height:63px;border-radius:10px 10px 26px 26px;background:#a56743;box-shadow:inset -14px -5px 0 #0001;border-top:5px solid #754c34}.pot:nth-child(2){background:#ece1cb;height:48px;width:86px;border-color:#bca88b}.pot:nth-child(3){background:#605f43;width:45px;height:75px;border-color:#3f4935}
  .dev{background:#172429;color:#e2f0d7}.dev h2{font-family:Arial,"PingFang SC",sans-serif;font-weight:700}.dev .cta{background:#b8e88b;color:#172429}.terminal{margin-top:18px;background:#0c1519;padding:14px;font:14px/1.8 ui-monospace,Menlo,monospace;color:#b8e88b}
  .sampleGrid .site{height:100%}.compact{padding:14px}.compact nav{margin-bottom:10px;padding-bottom:7px}.compact .brand{font-size:17px}.compact h2{font-size:25px}.compact p{font-size:14px}.compact .cta{font-size:13px;margin-top:12px;padding:6px 10px}.compact .landscape{height:60px;margin-top:10px}
  </style>`;
}

function site(kind, w, compact = false) {
  const body = {
    journal: `<small>${w.issue}</small><h2>${w.story}</h2><p>${w.sub}</p><div class="landscape"></div><span class="cta">${w.read}</span>`,
    saas: `<h2>${w.plan}</h2><p>${w.planSub}</p><div class="tasks"><div class="task"><b>${w.start}</b><span>03</span></div><div class="task"><span>${w === words.zh ? '起草新一期内容' : 'Draft the next issue'}</span><span>✓</span></div><div class="task"><span>${w === words.zh ? '整理灵感笔记' : 'Gather field notes'}</span><span>↗</span></div></div>`,
    craft: `<h2>${w.shop}</h2><p>${w.shopSub}</p><div class="pottery"><i class="pot"></i><i class="pot"></i><i class="pot"></i></div><span class="cta">${w.browse}</span>`,
    dev: `<h2>${w.ship}</h2><p>${w.shipSub}</p><div class="terminal">$ nb check<br>✓ api &nbsp; 24ms<br>✓ worker &nbsp; 18ms<br>${w.terminal}</div><span class="cta">$ nb deploy →</span>`,
  }[kind];
  return `<article class="site ${kind === 'journal' ? '' : kind} ${compact ? 'compact' : ''}"><nav><span class="brand">${w[kind]}</span><span>↗</span></nav>${body}</article>`;
}

function hero(theme, lang, d) {
  const w = words[lang], r = d.rows[0];
  return `${base(theme, lang)}<main><div class="grid" style="grid-template-columns:1fr 54px 1fr;align-items:center">
  <section class="panel"><div class="bar">tokens.json<span class="tag">${w.source}</span></div><div class="pad"><pre>"color.accent":<br>  <b>${esc(r.value)}</b><br><span class="accent">  ↳ ${r.file}:${r.line}</span></pre></div></section>
  <div style="font-size:36px;text-align:center;color:var(--accent)">⇄</div>
  <section class="panel"><div class="bar">${r.file}:${r.line}</div><div class="pad"><pre><b>${esc(r.selector)}</b> {<br>${esc(d.css[r.line - 1].trim())}<br>}</pre></div></section>
  </div><footer>✓ ${w.verified}</footer></main></html>`;
}

function showcase(theme, lang) {
  const w = words[lang];
  return `${base(theme, lang)}<main><header><h1>${w.output}</h1><p>${w.outputSub}</p></header>
  <div class="grid" style="grid-template-columns:244px 244px 1fr;align-items:stretch">
    <section class="panel"><div class="bar">01 / tokens.json</div><div class="pad"><pre>{
 "color": {
  "accent": {
   "$type": "color",
   "$value": "#a34f36"
  }
 }
}</pre><div style="display:flex;gap:9px;margin-top:24px">${['#a34f36','#292b23','#f5f0e4','#818c68'].map(c => `<i style="width:36px;height:36px;background:${c};border:1px solid #8885;border-radius:50%"></i>`).join('')}</div></div></section>
    <section class="panel"><div class="bar">02 / DESIGN.md</div><div class="pad"><h3># ${w.rules}</h3><p style="margin-top:18px">${w.rule1}</p><p style="margin-top:16px">${w.rule2}</p><p style="margin-top:16px">${w.rule3}</p><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><span class="tag" style="background:#a34f36;color:#fff9ef">#a34f36</span></div></section>
    <section class="panel"><div class="bar">03 / ${w.page}</div>${site('journal', w, true)}</section>
  </div><footer>${w.demo}</footer></main></html>`;
}

function samples(theme, lang) {
  const w = words[lang];
  return `${base(theme, lang)}<main><header><h1>${w.samples}</h1><p>${w.samplesSub}</p></header><div class="grid sampleGrid" style="grid-template-columns:1fr 1fr">${['journal','saas','craft','dev'].map(k => `<section class="panel">${site(k,w)}</section>`).join('')}</div></main></html>`;
}

function workflow(theme, lang) {
  const w = words[lang];
  const mini = variant => `<div class="layout ${variant}"><b>${w.journal}</b><div class="layoutContent"><div><strong>${lang === 'zh' ? '周日，慢一点。' : 'A slower Sunday.'}</strong><span>${lang === 'zh' ? '记录日常里的美好。' : 'Small things, well noticed.'}</span></div><div class="miniArt"></div></div><em>${w.read}</em></div>`;
  return `${base(theme, lang)}<style>
  .steps>section{display:flex;flex-direction:column}.steps>section>.panel{flex:1}.stepTitle{display:flex;align-items:center;gap:10px;margin-bottom:14px}.stepTitle b{background:var(--accent);color:var(--bg);border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px}.caption{font-size:14px;margin-top:14px}.voteCard{border:1px solid var(--line);border-radius:6px;overflow:hidden;margin-bottom:12px}.voteCard:last-child{margin:0}.voteActions{display:flex;justify-content:space-between;align-items:center;padding:8px;font-size:13px}.voteActions b{background:var(--accent);color:var(--bg);padding:4px 10px;border-radius:5px}.voteCard .site h2{font-size:23px}.voteCard .site .cta,.voteCard .site .landscape,.voteCard .site .pottery{display:none}
  .layout{padding:10px;background:#f5f0e4;color:#292b23;border:1px solid #d9d0bf;margin-bottom:10px;font-size:14px}.layout>b{font:700 15px Georgia,"Songti SC",serif}.layoutContent{margin:8px 0;display:flex;gap:10px}.layout strong{font:20px/1.1 Georgia,"Songti SC",serif;display:block}.layout span{display:block;font-size:13px;margin-top:5px}.miniArt{min-width:60px;background:#818c68;height:46px;border-radius:60px 0 0 0}.layout em{font-size:13px;color:#a34f36;font-style:normal}.centered{text-align:center}.centered .miniArt{display:none}.editorial .layoutContent{flex-direction:row-reverse}.layoutName{font-size:13px;margin-bottom:4px;color:var(--muted)}.chosen{outline:2px solid var(--accent);outline-offset:1px}
  .revision{background:#f5f0e4;color:#292b23;padding:16px;margin-top:8px}.revision strong{display:block;font:23px/1.2 Georgia,"Songti SC",serif;margin:12px 0}.revision p{font-size:14px;color:#595b4f}.revision .cta{margin-top:14px}.marked{border:2px dashed #a34f36;padding:8px}.revision.after strong{font-size:29px}.note{padding:10px 0;font-size:14px;color:var(--muted)}
  </style><main><div class="grid steps" style="grid-template-columns:repeat(3,1fr);gap:20px">
  <section><div class="stepTitle"><b>1</b><h2>${w.vote}</h2><span style="margin-left:auto">→</span></div><div class="panel pad">
  ${['journal','craft'].map((k,i) => `<div class="voteCard">${site(k,w,true)}<div class="voteActions"><span>${i ? w.color : w.type}</span><b>${w.selected}</b></div></div>`).join('')}</div><p class="caption">${w.voteCap}</p></section>
  <section><div class="stepTitle"><b>2</b><h2>${w.compare}</h2><span style="margin-left:auto">→</span></div><div class="panel pad">${['centered','split','editorial'].map(k => `<div class="layoutName">${w[k]} ${k === 'split' ? '✓' : ''}</div><div class="${k === 'split' ? 'chosen' : ''}">${mini(k)}</div>`).join('')}</div><p class="caption">${w.compareCap}</p></section>
  <section><div class="stepTitle"><b>3</b><h2>${w.revise}</h2></div><div class="panel pad"><small>${w.before}</small><div class="revision"><b>${w.journal}</b><strong class="marked">${w.story}</strong><p>${w.sub}</p></div><div class="note">↳ ${w.note}</div><small>${w.after}</small><div class="revision after"><b>${w.journal}</b><strong>${w.story}</strong><p>${w.sub}</p><span class="cta">${w.read}</span></div></div><p class="caption">${w.reviseCap}</p></section>
  </div></main></html>`;
}

export async function readmeArt(o = {}) {
  const out = path.resolve(o.out || path.join(root, 'docs/readme'));
  await fs.mkdir(out, { recursive: true });
  const d = await extraction();
  const { browser } = await openBrowser();
  const shots = [];
  try {
    for (const lang of ['en', 'zh']) for (const theme of ['light', 'dark']) {
      for (const [name, render] of Object.entries({hero, showcase, samples, workflow})) {
        const file = `${name}-${theme}${lang === 'zh' ? '.zh-CN' : ''}.png`;
        const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
        try {
          await page.route('**/*', route => route.abort());
          await page.setContent(render(theme, lang, d));
          await page.evaluate(() => document.fonts.ready);
          const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
            const r = el.getBoundingClientRect();
            return !el.matches('.landscape') && r.width && (r.right > 900.5 || r.left < -.5 || el.scrollWidth > el.clientWidth + 1);
          }).map(el => el.tagName + ': ' + el.textContent.slice(0, 60)));
          if (overflow.length) throw Error(`${file}: overflowing content: ${overflow.join('; ')}`);
          await page.locator('body').screenshot({ path: path.join(out, file) });
          shots.push(file);
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
  return { out, shots, verify: d.verify };
}
cli(import.meta.url, readmeArt);
