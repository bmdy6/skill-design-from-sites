import StyleDictionary from "style-dictionary";
import path from "node:path";
import { cli, readJSON } from "./lib/io.mjs";
const dimension = (value) =>
  typeof value === "object" && value !== null
    ? `${value.value}${value.unit}`
    : String(value);
StyleDictionary.registerTransform({
  name: "dfs/dimension",
  type: "value",
  filter: (t) => (t.$type || t.type) === "dimension",
  transform: (t) => dimension(t.$value ?? t.value),
});
StyleDictionary.registerTransform({
  name: "dfs/shadow",
  type: "value",
  filter: (t) => (t.$type || t.type) === "shadow",
  transform: (t) =>
    [t.$value ?? t.value]
      .flat()
      .map((s) =>
        [
          ...(s.inset ? ["inset"] : []),
          dimension(s.offsetX),
          dimension(s.offsetY),
          dimension(s.blur),
          dimension(s.spread),
          s.color,
        ].join(" "),
      )
      .join(", "),
});
export async function emit(o) {
  const sd = new StyleDictionary({
    tokens: await readJSON(o.tokens),
    log: { verbosity: "silent" },
    platforms: {
      css: {
        transforms: [
          "name/kebab",
          "color/css",
          "fontFamily/css",
          "dfs/dimension",
          "dfs/shadow",
        ],
        buildPath: path.resolve(o.out) + path.sep,
        files: [
          {
            destination: "tokens.css",
            format: "css/variables",
            options: { outputReferences: false },
          },
        ],
      },
    },
  });
  await sd.buildAllPlatforms();
  return { ok: true };
}
cli(import.meta.url, emit);
