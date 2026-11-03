import fs from "node:fs/promises";
import path from "node:path";
import { cli, readJSON, write, exists, fail } from "./lib/io.mjs";
import { htmlTree, walk, attr, escape } from "./lib/html.mjs";
import { checkText } from "./check.mjs";
const blocks = new Set([
  "main",
  "section",
  "article",
  "header",
  "footer",
  "nav",
  "aside",
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "form",
  "button",
  "input",
  "figure",
  "table",
  "blockquote",
]);
export function prepareText(text, tokensCSS) {
  const tree = htmlTree(text),
    ids = new Set(),
    patches = [],
    added = [];
  walk(tree, (n) => {
    const id = attr(n, "data-ds-id");
    if (id) {
      if (ids.has(id)) fail("Duplicate data-ds-id " + id);
      ids.add(id);
    }
    for (const a of n.attrs || [])
      if (/^(?:javascript|vbscript):/i.test(a.value.trim()))
        fail("Executable resource URLs are prohibited");
    for (const a of n.attrs || [])
      if (
        ["src", "poster", "srcset", "href", "data"].includes(a.name) &&
        !(n.tagName === "a" && a.name === "href") &&
        /(?:https?:)?\/\//i.test(a.value)
      )
        fail("External resources are prohibited");
  });
  if (/(?:url\s*\(\s*["']?|@import\s*["'])(?:https?:)?\/\//i.test(text))
    fail("External CSS resources are prohibited");
  let i = 0;
  walk(tree, (n) => {
    if (
      !blocks.has(n.tagName) ||
      attr(n, "data-ds-id") ||
      !n.sourceCodeLocation?.startTag
    )
      return;
    let id;
    do {
      id = "ds-" + ++i;
    } while (ids.has(id));
    ids.add(id);
    added.push(id);
    const offset = n.sourceCodeLocation.startTag.endOffset - 1;
    patches.push({ offset, value: ` data-ds-id="${id}"` });
  });
  let linked = false;
  walk(tree, (n) => {
    if (n.tagName === "link" && attr(n, "href") === tokensCSS) linked = true;
  });
  if (!linked) {
    const index = text.search(/<\/head\s*>/i);
    patches.push({
      offset: index >= 0 ? index : 0,
      value: `<link rel="stylesheet" href="${escape(tokensCSS)}">`,
    });
  }
  for (const p of patches.sort((a, b) => b.offset - a.offset))
    text = text.slice(0, p.offset) + p.value + text.slice(p.offset);
  return { text, added };
}
export function validateResources(text) {
  // Validation only: leave fragment structure and bytes untouched.
  prepareText(text, "tokens.css");
}
export async function prepare(o) {
  const original = await fs.readFile(o.file, "utf8"),
    css = path
      .relative(path.dirname(o.file), o["tokens-css"])
      .split(path.sep)
      .join("/");
  const r = prepareText(original, css);
  const tokenFile =
    o.tokens || path.join(path.dirname(o["tokens-css"]), "tokens.json");
  if (!(await exists(tokenFile)))
    fail("tokens.json required beside tokens.css or via --tokens");
  const findings = checkText(r.text, o.file, await readJSON(tokenFile));
  if (findings.length) return { ok: false, added: [], findings };
  if (r.text !== original) {
    await write(o.file + ".bak", original);
    await write(o.file, r.text);
  }
  return { ok: true, added: r.added, findings };
}
cli(import.meta.url, async (o) => {
  const r = await prepare(o);
  if (!r.ok) process.exitCode = 1;
  return r;
});
