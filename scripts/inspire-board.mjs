import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { cli, readJSON, writeJSON, write, exists, fail } from "./lib/io.mjs";
import { escape } from "./lib/html.mjs";
import { pendingGate } from "./lib/gates.mjs";
import { previewServer } from "./preview-serve.mjs";
const aspects = ["color", "type", "layout", "whitespace", "motion", "imagery"];
export function recordVote(data, item, options = {}) {
  if (
    !["like", "dislike", "skip"].includes(item.vote) ||
    !item.cid ||
    (item.aspects || []).some((a) => !aspects.includes(a))
  )
    fail("Invalid vote");
  const value = {
    cid: item.cid,
    round: Number(options.round || 1),
    vote: item.vote,
    aspects: item.aspects || [],
    comment: item.comment || "",
    by: options.by || "self",
    at: options.at || new Date().toISOString(),
  };
  data.items = data.items.filter(
    (v) =>
      !(v.cid === value.cid && v.round === value.round && v.by === value.by),
  );
  data.items.push(value);
  return data;
}
export function voteCLI(text, data = { items: [] }, options = {}) {
  for (const part of text.split(";").filter(Boolean)) {
    const m = part.match(/^([\w-]+)=(like|dislike|skip)(?::([\w,-]+))?$/);
    if (!m) fail("Expected cid=like:color,layout");
    recordVote(
      data,
      { cid: m[1], vote: m[2], aspects: m[3] ? m[3].split(",") : [] },
      options,
    );
  }
  return data;
}
export function boardHTML(captures) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Choose a direction</title><style>body{font:16px/1.5 system-ui;background:#f1f0eb;color:#172033;margin:0}header{padding:48px 5vw 24px}h1{font-size:40px;letter-spacing:-1px;margin:0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;padding:24px 5vw 64px}article{background:white;border:1px solid #d8d8d0;border-radius:12px;overflow:hidden}article>iframe{width:100%;height:420px;border:0}article>img{width:100%;aspect-ratio:8/5;object-fit:cover;background:#d8d8d0}.content{padding:24px}h2{margin:0 0 8px}a{color:#2549b8}fieldset{border:0;padding:16px 0;display:flex;gap:10px;flex-wrap:wrap}input[type=text]{box-sizing:border-box;width:100%;padding:10px;border:1px solid #ccd0d8}button{padding:10px 18px;margin:16px 8px 0 0;border:1px solid #ccd0d8;border-radius:6px;background:white;cursor:pointer}button[data-vote=like]{background:#172033;color:white} [role=status]{min-height:24px}</style></head><body><header><p>YOUR DESIGN REFERENCES</p><h1>Choose what feels right.</h1><p>Vote on the parts you like. Every reference links back to its source.</p><div role="status"></div></header><main>${captures.map((c) => `<article>${c.variant ? `<iframe title="${escape(c.title)}" sandbox="allow-same-origin" src="/__dfs/variant/${encodeURIComponent(c.cid)}"></iframe>` : `<img src="/__dfs/thumb/${encodeURIComponent(c.cid)}" alt="Original source preview">`}<div class="content"><h2>${escape(c.title || c.cid)}</h2><a href="${escape(c.url)}" target="_blank" rel="noopener">Original site ↗</a>${c.galleryUrl ? ` · <a href="${escape(c.galleryUrl)}" rel="noopener">Gallery</a>` : ""}<fieldset><legend>What works?</legend>${aspects.map((a) => `<label><input type="checkbox" name="${escape(c.cid)}-${a}" data-aspect="${a}">${a}</label>`).join("")}</fieldset><input type="text" aria-label="Comment" placeholder="What would you borrow?"><div>${["like", "dislike", "skip"].map((v) => `<button data-cid="${escape(c.cid)}" data-vote="${v}">${{ like: "Like", dislike: "Pass", skip: "Skip" }[v]}</button>`).join("")}</div></div></article>`).join("")}</main><script>document.querySelectorAll('[data-vote]').forEach(button=>button.onclick=async()=>{const card=button.closest('article');const response=await fetch('/__dfs/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cid:button.dataset.cid,vote:button.dataset.vote,aspects:[...card.querySelectorAll('input:checked')].map(n=>n.dataset.aspect),comment:card.querySelector('input[type=text]').value})});document.querySelector('[role=status]').textContent=response.ok?'Saved':'Could not save';});</script></body></html>`;
}
export async function board(o) {
  const input = await readJSON(o.captures);
  const variantMode = o.mode === "variants";
  const run = path.dirname(path.resolve(o.captures));
  const data = variantMode
    ? {
        round: 1,
        captures: input.variants.map((v) => ({
          cid: v.id,
          title: `Direction ${v.id} — ${v.layout}`,
          url: `/__dfs/variant/${v.id}`,
          variant: true,
          file: v.file,
        })),
      }
    : input;
  const applySelection = async (item) => {
    if (!variantMode || item.vote !== "like") return;
    input.picked = item.cid;
    input.selection = {
      basis: [{ kind: "taste", ref: "vote:" + item.cid }],
      by: "user",
    };
    await writeJSON(o.captures, input);
    const briefFile = path.join(run, "brief.json"),
      brief = (await exists(briefFile)) ? await readJSON(briefFile) : null;
    await pendingGate(
      run,
      "variant",
      "Confirm the selected direction.",
      ["approve", "revise"],
      brief?.mode === "company" && brief.company.approvers.includes("variant")
        ? "boss"
        : "user",
    );
  };
  o = { ...o, round: o.round || data.round || 1 };
  const votes = (await exists(o.votes))
    ? await readJSON(o.votes)
    : { items: [] };
  if (o.vote) {
    const r = voteCLI(o.vote, votes, o);
    const known = new Set(data.captures.map((c) => c.cid));
    if (r.items.some((v) => !known.has(v.cid))) fail("Unknown candidate");
    await writeJSON(o.votes, r);
    for (const item of r.items) await applySelection(item);
    return r;
  }
  const cacheRoot = path.join(os.homedir(), ".cache/design-from-sites");
  await fs.mkdir(cacheRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(cacheRoot, "board-"));
  await write(
    path.join(root, "index.html"),
    boardHTML(
      data.captures.filter(
        (c) => !data.currentCids || data.currentCids.includes(c.cid),
      ),
    ),
  );
  let queue = Promise.resolve();
  const server = await previewServer({
    dir: root,
    feedback: path.join(root, "feedback.json"),
    handle: async (req, res, u) => {
      if (variantMode && u.pathname.startsWith("/__dfs/variant/")) {
        const cid = decodeURIComponent(
            u.pathname.slice("/__dfs/variant/".length),
          ),
          card = data.captures.find((c) => c.cid === cid);
        if (!card) throw Error("Unknown variant");
        const file = await fs.realpath(path.resolve(run, card.file));
        const realRoot = await fs.realpath(run);
        if (!file.startsWith(realRoot + path.sep) || !file.endsWith(".html"))
          throw Error("Variant outside run");
        res.setHeader("Content-Type", "text/html");
        res.end(await fs.readFile(file));
        return true;
      }
      if (variantMode && u.pathname === "/__dfs/tokens.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(await fs.readFile(path.join(run, "tokens.css")));
        return true;
      }
      if (u.pathname.startsWith("/__dfs/thumb/")) {
        const cid = decodeURIComponent(
            u.pathname.slice("/__dfs/thumb/".length),
          ),
          c = data.captures.find((c) => c.cid === cid);
        if (!c?.thumb) {
          res.writeHead(404);
          res.end();
          return true;
        }
        const cache = await fs.realpath(
            path.join(os.homedir(), ".cache/design-from-sites/shots"),
          ),
          file = await fs.realpath(c.thumb);
        if (!file.startsWith(cache + path.sep))
          throw Error("Thumbnail outside screenshot cache");
        res.setHeader("Content-Type", "image/webp");
        res.end(await fs.readFile(file));
        return true;
      }
      if (u.pathname === "/__dfs/vote" && req.method === "POST") {
        if (req.headers.origin && req.headers.origin !== u.origin)
          throw Error("Origin rejected");
        if (req.headers["content-type"] !== "application/json")
          throw Error("JSON required");
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 65536) throw Error("Body too large");
        }
        const item = JSON.parse(body);
        if (!data.captures.some((c) => c.cid === item.cid))
          fail("Unknown candidate");
        queue = queue
          .catch(() => {})
          .then(async () => {
            recordVote(votes, item, o);
            await writeJSON(o.votes, votes);
            await applySelection(item);
          });
        await queue;
        res.end("Saved");
        return true;
      }
      return false;
    },
  });
  if (o.open !== false) {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "explorer"
          : "xdg-open";
    execFile(command, [server.url], () => {});
  }
  const close = server.close;
  server.close = async () => {
    await close();
    await fs.rm(root, { recursive: true, force: true });
  };
  return server;
}
cli(import.meta.url, async (o) => {
  const r = await board(o);
  return o.vote ? r : { url: r.url };
});
