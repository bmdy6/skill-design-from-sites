import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import { cli, readJSON, files } from "./lib/io.mjs";
import { flattenTokens } from "./build-tokens.mjs";
import { color, deltaE } from "./lib/color.mjs";
const kindFor = (p) =>
  /color|background|fill|stroke/.test(p)
    ? "color"
    : /font-size/.test(p)
      ? "font-size"
      : /radius/.test(p)
        ? "radius"
        : /shadow/.test(p)
          ? "shadow"
          : /padding|margin|gap|width|height|top|left|right|bottom/.test(p)
            ? "spacing"
            : null;
export const variable = (p) =>
  "--" + p.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()).replaceAll(".", "-");
export function checkText(text, file, tokens, allow = []) {
  const findings = [],
    flat = flattenTokens(tokens),
    lines = text.split("\n");
  const ignored = new Set();
  lines.forEach((l, i) => {
    if (/dfs-ignore-next-line/.test(l)) ignored.add(i + 2);
    else if (/dfs-ignore\b/.test(l)) ignored.add(i + 1);
  });
  const add = (property, value, index) => {
    property = property.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    let kind = kindFor(property);
    const clean = value
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/var\([^)]*\)/g, "")
      .trim();
    if (property.startsWith("--")) {
      const entry = Object.entries(flat).find(
        ([p]) => variable(p) === property,
      );
      if (entry && entry[1].$value === value.trim()) return;
    }
    const hasColor =
      !!color(clean) || clean.split(/[\s,()]+/).some((word) => !!color(word));
    if (!kind)
      kind = hasColor
        ? "color"
        : property.startsWith("--") ||
            /border|transform|translate/.test(property)
          ? "spacing"
          : null;
    if (!kind) return;
    if (
      !clean ||
      /^(?:0(?:px|rem)?|inherit|currentColor|transparent|none|auto|initial|unset)$/i.test(
        clean,
      )
    )
      return;
    if (
      !hasColor &&
      !/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(|(?:\d*\.)?\d+(?:px|rem)\b/i.test(
        clean,
      ) &&
      !(kind === "font-size" && /^\d/.test(clean))
    )
      return;
    const before = text.slice(0, index),
      line = before.split("\n").length,
      column = index - (before.lastIndexOf("\n") + 1) + 1;
    if (
      ignored.has(line) ||
      allow.some(
        (a) =>
          a.file === file &&
          a.line === line &&
          (!a.property || a.property === property),
      )
    )
      return;
    let nearestToken = null,
      nearestValue = null,
      min = Infinity;
    const cat = kind === "font-size" ? "fontSize" : kind;
    const parsed = kind === "color" ? color(clean) : null;
    for (const [p, t] of Object.entries(flat)) {
      if (!p.startsWith(cat + ".")) continue;
      let distance;
      if (parsed && typeof t.$value === "string" && color(t.$value))
        distance = deltaE(parsed.hex, t.$value);
      else if (typeof t.$value === "object")
        distance = Math.abs(parseFloat(clean) - (t.$value.value || 0));
      else if (t.$value === clean) distance = 0;
      else continue;
      if (distance < min) {
        min = distance;
        nearestToken = p;
        nearestValue = t.$value;
      }
    }
    findings.push({
      file,
      line,
      column,
      property,
      value: value.trim(),
      kind,
      nearestToken,
      nearestValue,
      delta:
        kind === "color"
          ? { deltaE: Number.isFinite(min) ? min : null }
          : { px: Number.isFinite(min) ? min : null },
      suggestion: nearestToken ? `var(${variable(nearestToken)})` : null,
    });
  };
  const css = (source, offset) => {
    const tree = postcss.parse(source, { from: file });
    tree.walkDecls((d) => add(d.prop, d.value, offset + d.source.start.offset));
  };
  if (/\.css$/i.test(file)) css(text, 0);
  else {
    for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi))
      css(m[1], m.index + m[0].indexOf(">") + 1);
    for (const m of text.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) {
      const offset = m.index + m[0].indexOf(m[2]);
      const tree = postcss.parse("x{" + m[2] + "}");
      tree.walkDecls((d) =>
        add(d.prop, d.value, offset + d.source.start.offset - 2),
      );
    }
    for (const m of text.matchAll(/\bstyle\s*=\s*\{\{([\s\S]*?)\}\}/g)) {
      const start = m.index + m[0].indexOf(m[1]);
      for (const d of m[1].matchAll(
        /([A-Za-z][\w]*)\s*:\s*(?:['"]([^'"]+)['"]|(-?\d+(?:\.\d+)?))/g,
      ))
        add(d[1], d[2] || d[3], start + d.index);
    }
    for (const m of text.matchAll(
      /\b(text|bg|p[trblxy]?|m[trblxy]?|gap|rounded|shadow|w|h)-\[([^\]]+)\]/g,
    )) {
      const p =
        {
          text: /^#|^rgb|^hsl/.test(m[2]) ? "color" : "font-size",
          bg: "background-color",
          rounded: "border-radius",
          shadow: "box-shadow",
          gap: "gap",
          w: "width",
          h: "height",
        }[m[1]] || (/^[pm]/.test(m[1]) ? "padding" : "margin");
      add(p, m[2], m.index);
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}
export async function checkPaths(paths, tokens, allow = []) {
  const list = [...new Set((await Promise.all(paths.map(files))).flat())]
    .filter((f) => /\.(?:css|html|jsx|tsx|js|ts)$/i.test(f))
    .sort();
  const findings = [];
  for (const f of list)
    findings.push(...checkText(await fs.readFile(f, "utf8"), f, tokens, allow));
  return {
    summary: { files: list.length, findings: findings.length },
    findings,
  };
}
cli(import.meta.url, async (o) => {
  const r = await checkPaths(
    [o.paths, ...o._].flat().filter(Boolean),
    await readJSON(o.tokens),
    o.allow ? await readJSON(o.allow) : [],
  );
  if (r.summary.findings) process.exitCode = 1;
  if (o.format === "json") return r;
  console.log(
    r.findings
      .map(
        (f) =>
          `${f.file}:${f.line}:${f.column} ${f.property}: ${f.value} → ${f.suggestion || "add an evidenced token"}`,
      )
      .join("\n") || "No findings",
  );
});
