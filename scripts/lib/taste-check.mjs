import { converter } from "culori";
const lab = converter("oklab"),
  get = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
export function checkAxes(taste, actual, where) {
  const violations = [],
    unchecked = [];
  let checked = 0;
  for (const [axis, rule] of Object.entries(taste.axes)) {
    if (Math.abs(rule.strength) < 0.5) continue;
    const value = get(actual, axis);
    if (value === undefined) {
      unchecked.push(axis);
      continue;
    }
    checked++;
    if (
      rule.prefer !== undefined
        ? value !== rule.prefer
        : !Number.isFinite(value) ||
          value < rule.range[0] - 1e-6 ||
          value > rule.range[1] + 1e-6
    )
      violations.push({
        axis,
        expected: rule.prefer ?? rule.range,
        actual: value,
        where,
      });
  }
  return {
    ok: !violations.length,
    score: checked ? 1 - violations.length / checked : 1,
    violations,
    unchecked,
  };
}
export function checkTasteTokens(taste, tokens) {
  const numbers = (cat) =>
    Object.values(tokens[cat] || {})
      .map((t) => t.$value?.value)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  const radius = numbers("radius"),
    sizes = numbers("fontSize"),
    surface = tokens.color?.surface?.$value,
    fonts = Object.values(tokens.fontFamily || {}).map((t) => String(t.$value));
  const actual = {};
  if (radius.length) actual.radiusPx = radius[Math.floor(radius.length / 2)];
  if (sizes.length) {
    actual.basePx = sizes.includes(16) ? 16 : sizes[0];
    actual.headingRatio = sizes.at(-1) / actual.basePx;
  }
  if (surface) {
    actual.bgL = lab(surface).l;
    actual.theme = actual.bgL < 0.5 ? "dark" : "light";
  }
  if (fonts.length) {
    actual.fontClass = { serif: 0, sans: 0, mono: 0, display: 0 };
    for (const f of fonts)
      actual.fontClass[
        /mono/i.test(f)
          ? "mono"
          : /sans|Arial|Helvetica/i.test(f)
            ? "sans"
            : /serif|Georgia|Times/i.test(f)
              ? "serif"
              : "display"
      ] += 1 / fonts.length;
  }
  return checkAxes(taste, actual, "tokens");
}
