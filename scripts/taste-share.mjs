import path from "node:path";
import { cli, readJSON, write } from "./lib/io.mjs";
import { escape } from "./lib/html.mjs";
export function shareText(taste, tokens) {
  const references = taste.references.filter(
    (r) => !/[<\n]|\.(png|webp|jpg)/i.test(r.url),
  );
  return (
    "# 审美方向\n\n" +
    `Confidence: ${taste.confidence}\n\n` +
    references
      .map((r, i) => `${i + 1}. ${r.role}: [参考站](${r.url})`)
      .join("\n") +
    "\n\n" +
    (taste.rules || []).map((r) => "- " + escape(r.text)).join("\n") +
    "\n\n" +
    Object.entries(tokens.color || {})
      .map(
        ([name, t]) =>
          `<span style="display:inline-block;padding:1em;background:${escape(t.$value)}" aria-label="${escape(name)}">&nbsp;</span> ${escape(name)}`,
      )
      .join("\n") +
    "\n\n请回复喜欢的参考编号、喜欢哪些部分，以及需要调整的方向。\n"
  );
}
export function shareHTML(taste, tokens) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>审美方向</title><style>body{font:18px/1.7 system-ui;background:#f5f4ee;color:#172033;max-width:960px;margin:64px auto;padding:32px}h1{font-size:48px}a{color:#2549b8}.swatches{display:flex;gap:16px}.swatches{flex-wrap:wrap}.swatches span{display:block;width:120px;height:80px;border:1px solid #ddd}.swatches p{margin:8px 0}section{padding:24px 0;border-top:1px solid #ddd}</style></head><body><p>DESIGN DIRECTION</p><h1>从偏好，走向明确的选择。</h1><p>以下只包含参考链接、自己的说明和设计色块。</p><section><h2>参考分工</h2>${taste.references
    .filter((r) => !/[<\n]|\.(png|webp|jpg)/i.test(r.url))
    .map(
      (r) =>
        `<p><a href="${escape(r.url)}">${escape(r.role)} · ${escape(r.url)}</a></p>`,
    )
    .join(
      "",
    )}</section><section><h2>审美取向</h2>${taste.rules.map((r) => `<p>${escape(r.text)}</p>`).join("") || "<p>请对参考方向给出反馈；偏好仍待确认。</p>"}</section><section><h2>设计色块</h2><div class="swatches">${Object.entries(
    tokens.color || {},
  )
    .map(
      ([n, t]) =>
        `<div><span aria-hidden="true" style="background:${escape(t.$value)}"></span><p>${escape(n)}</p></div>`,
    )
    .join(
      "",
    )}</div></section><p>回复喜欢的参考编号和具体方面，即可继续收敛。</p></body></html>`;
}
export async function tasteShare(o) {
  const taste = await readJSON(o.taste),
    tokens = o.tokens ? await readJSON(o.tokens) : { color: {} };
  const out = o.out || path.join(path.dirname(o.taste), "taste-share.md");
  await write(out, shareText(taste, tokens));
  await write(out.replace(/\.md$/, ".html"), shareHTML(taste, tokens));
  return { ok: true, file: out };
}
cli(import.meta.url, tasteShare);
