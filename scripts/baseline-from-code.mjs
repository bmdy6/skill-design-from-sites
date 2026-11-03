import { typeNames } from "./lib/scale.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import { parse, parseExpressionAt } from "acorn";
import { cli, files, writeJSON, readJSON, fail } from "./lib/io.mjs";
import { flattenTokens } from "./build-tokens.mjs";
import { color } from "./lib/color.mjs";
import { validate } from "./lib/schema.mjs";
const prefixes = {
  color: "c",
  fontFamily: "f",
  fontSize: "t",
  fontWeight: "w",
  lineHeight: "lh",
  spacing: "sp",
  radius: "r",
  shadow: "sh",
  maxWidth: "mw",
};
const cssCategory = (name) =>
  /^--(?:max-width|layout-width)-/.test(name)
    ? "maxWidth"
    : /^--(?:color|bg|text)-/.test(name)
      ? "color"
      : /^--font-family-/.test(name)
        ? "fontFamily"
        : /^--font-size-/.test(name)
          ? "fontSize"
          : /^--font-weight-/.test(name)
            ? "fontWeight"
            : /^--line-height-/.test(name)
              ? "lineHeight"
              : /^--(?:spacing|space)-/.test(name)
                ? "spacing"
                : /^--(?:radius|border-radius)-/.test(name)
                  ? "radius"
                  : /^--(?:shadow|box-shadow)-/.test(name)
                    ? "shadow"
                    : null;
export function staticConfig(text) {
  const tree = parse(text, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
    }),
    bindings = new Map();
  for (const n of tree.body)
    if (n.type === "VariableDeclaration")
      for (const d of n.declarations)
        if (d.id.type === "Identifier") bindings.set(d.id.name, d.init);
  const evaluate = (node, seen = new Set()) => {
    if (!node) fail("Missing config");
    if (node.type === "Literal") return node.value;
    if (
      node.type === "Identifier" &&
      bindings.has(node.name) &&
      !seen.has(node.name)
    )
      return evaluate(bindings.get(node.name), new Set([...seen, node.name]));
    if (node.type === "ArrayExpression")
      return node.elements.map((n) => evaluate(n, seen));
    if (node.type === "ObjectExpression")
      return Object.fromEntries(
        node.properties.map((p) => {
          if (p.type !== "Property" || p.computed || p.method)
            fail("Dynamic config is unsupported; supply static tokens instead");
          return [p.key.name ?? p.key.value, evaluate(p.value, seen)];
        }),
      );
    if (node.type === "UnaryExpression" && ["+", "-"].includes(node.operator))
      return node.operator === "-"
        ? -evaluate(node.argument, seen)
        : +evaluate(node.argument, seen);
    fail("Dynamic config is unsupported; supply static tokens instead");
  };
  const result = (root) => ({
    value: evaluate(root),
    locate(keys) {
      let node = root;
      const resolve = () => {
        const seen = new Set();
        while (
          node?.type === "Identifier" &&
          bindings.has(node.name) &&
          !seen.has(node.name)
        ) {
          seen.add(node.name);
          node = bindings.get(node.name);
        }
      };
      for (const key of keys) {
        resolve();
        node =
          node?.type === "ArrayExpression"
            ? node.elements[Number(key)]
            : node?.properties?.find(
                (p) => String(p.key.value ?? p.key.name) === key,
              )?.value;
      }
      resolve();
      if (!node) fail("Cannot locate static configuration value");
      return {
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
        authored: text.slice(node.start, node.end),
      };
    },
  });
  for (const n of tree.body) {
    if (n.type === "ExportDefaultDeclaration") return result(n.declaration);
    if (
      n.type === "ExpressionStatement" &&
      n.expression.type === "AssignmentExpression" &&
      n.expression.left.object?.name === "module" &&
      n.expression.left.property?.name === "exports"
    )
      return result(n.expression.right);
  }
  fail("No static config export found");
}
function valueLocation(text, keys) {
  let node = parseExpressionAt(text, text.search(/\S/), {
    ecmaVersion: "latest",
    locations: true,
  });
  for (const key of keys) {
    const property = node.properties?.find(
      (p) => String(p.key.value ?? p.key.name) === key,
    );
    if (!property) return null;
    node = property.value;
  }
  return {
    line: node.loc.start.line,
    column: node.loc.start.column + 1,
    authored: text.slice(node.start, node.end),
  };
}
export async function baselineFromCode(o) {
  const root = path.resolve(o.dir),
    all = (await files(root)).filter(
      (f) =>
        !f
          .split(path.sep)
          .some((n) =>
            ["node_modules", ".git", ".design-from-sites"].includes(n),
          ),
    );
  const clusters = Object.fromEntries(
      Object.keys(prefixes).map((k) => [k, []]),
    ),
    samples = {};
  let serial = 0;
  const add = (
    category,
    name,
    value,
    file,
    line,
    column,
    selector = ":root",
  ) => {
    if (!category) return;
    let normalized = value,
      px,
      unit;
    if (category === "color") {
      const c = color(String(value));
      if (!c) return;
      normalized = c.hex;
    } else if (
      ["fontSize", "spacing", "radius", "lineHeight", "maxWidth"].includes(
        category,
      )
    ) {
      const m = String(value).match(/^(-?\d+(?:\.\d+)?)(px|rem)?$/);
      if (!m) return;
      px = Number(m[1]);
      unit = m[2] || "px";
    } else if (category === "fontFamily" && Array.isArray(value))
      normalized = value.join(", ");
    const sid = "code-s" + ++serial;
    samples[sid] = {
      viewport: "code",
      selector,
      property: name,
      value: String(value),
      authoredValue: String(value),
      stylesheet: file,
      line,
      column,
      bbox: [],
      crop: null,
      url: pathToFileURL(file).href,
      collectedAt: null,
      count: 1,
      area: 0,
    };
    let c = clusters[category].find((c) => c.value === normalized);
    if (!c) {
      c = {
        id: prefixes[category] + (clusters[category].length + 1),
        value: normalized,
        count: 1,
        area: 0,
        weight: 1,
        sampleRefs: [],
        ...(px !== undefined ? { px, unit } : {}),
        ...(category === "color"
          ? {
              members: [normalized],
              cssVar: name.startsWith("--") ? name : null,
              composite: null,
            }
          : {}),
        ...(category === "fontFamily"
          ? {
              name: String(normalized).split(",")[0],
              openAlt: null,
              stack: normalized,
              licenseNote: "Local configuration; license not verified",
            }
          : {}),
      };
      clusters[category].push(c);
    }
    c.sampleRefs.push(sid);
  };
  for (const file of all) {
    if (
      !/\.(css|json)$/.test(file) &&
      !/tailwind\.config\.(mjs|cjs|js)$/.test(file)
    )
      continue;
    const text = await fs.readFile(file, "utf8");
    if (file.endsWith(".css")) {
      postcss.parse(text, { from: file }).walkDecls((d) => {
        const category = cssCategory(d.prop);
        if (category)
          add(
            category,
            d.prop,
            d.value,
            file,
            d.source.start.line,
            d.source.start.column,
            d.parent.selector,
          );
      });
    } else if (/tailwind\.config\.(?:mjs|cjs|js|json)$/.test(file)) {
      const parsed = file.endsWith(".json") ? null : staticConfig(text);
      const config = parsed ? parsed.value : JSON.parse(text);
      const theme = {
        ...(config.theme || {}),
        ...(config.theme?.extend || {}),
      };
      const categories = {
        colors: "color",
        maxWidth: "maxWidth",
        spacing: "spacing",
        fontSize: "fontSize",
        fontFamily: "fontFamily",
        borderRadius: "radius",
        boxShadow: "shadow",
        lineHeight: "lineHeight",
        fontWeight: "fontWeight",
      };
      const leaves = (v, p, fn) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          for (const [k, x] of Object.entries(v))
            leaves(x, p ? `${p}.${k}` : k, fn);
        } else fn(p, v);
      };
      for (const [key, category] of Object.entries(categories))
        if (theme[key])
          leaves(theme[key], key, (name, value) => {
            const keys = [
              "theme",
              ...(config.theme?.extend?.[key] ? ["extend"] : []),
              ...name.split("."),
            ];
            if (category === "fontSize" && Array.isArray(value)) {
              value = value[0];
              keys.push("0");
            }
            const location = parsed
              ? parsed.locate(keys)
              : valueLocation(text, keys);
            add(
              category,
              name,
              value,
              file,
              location.line,
              location.column,
              "theme",
            );
            samples["code-s" + serial].authoredValue = location.authored;
          });
    } else if (file.endsWith(".json")) {
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        continue;
      }
      for (const [name, t] of Object.entries(flattenTokens(json))) {
        const category = name.split(".")[0];
        if (!prefixes[category]) continue;
        const value =
            t.$value?.unit !== undefined
              ? String(t.$value.value) + t.$value.unit
              : t.$value,
          location = valueLocation(text, [...name.split("."), "$value"]);
        if (!location) fail("Cannot locate token source: " + name);
        add(
          category,
          name,
          value,
          file,
          location.line,
          location.column,
          "tokens",
        );
        samples["code-s" + serial].authoredValue = location.authored;
      }
    }
  }
  const autoNames = {};
  for (const category of ["spacing", "fontSize", "radius", "maxWidth"]) {
    clusters[category].sort(
      (a, b) =>
        a.px * (a.unit === "rem" ? 16 : 1) - b.px * (b.unit === "rem" ? 16 : 1),
    );
    autoNames[category] = Object.fromEntries(
      clusters[category].map((c, i) => [
        category === "spacing"
          ? String(i + 1)
          : category === "fontSize"
            ? ["sm", "base", "lg", "xl"][i] || String(i)
            : ["sm", "md", "lg", "xl"][i] || String(i),
        c.id,
      ]),
    );
  }
  autoNames.maxWidth = Object.fromEntries(
    clusters.maxWidth.map((c, i) => [String(i + 1), c.id]),
  );
  autoNames.fontSize = typeNames(clusters.fontSize);
  const result = {
    schemaVersion: 1,
    siteId: "baseline",
    url: pathToFileURL(root).href,
    hasCssVars: true,
    clusters,
    scales: {
      spacingBase: null,
      spacingFit: null,
      typeBase: null,
      typeRatio: null,
    },
    outliers: [],
    autoNames,
    componentCandidates: [],
    samples,
  };
  validate("evidence", result);
  if (o.out) await writeJSON(o.out, result);
  return result;
}
cli(import.meta.url, baselineFromCode);
