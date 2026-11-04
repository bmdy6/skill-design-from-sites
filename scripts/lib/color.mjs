import {
  parse,
  converter,
  formatHex,
  differenceCiede2000,
  wcagContrast,
} from "culori";
const rgb = converter("rgb"),
  lab = converter("oklab");
export const deltaE = differenceCiede2000();
export function color(value, back = "#ffffff") {
  try {
    const p = parse(value);
    if (!p) return null;
    const c = rgb(p);
    if ((c.alpha ?? 1) === 0) return null;
    const alpha = c.alpha ?? 1;
    const b = rgb(parse(back) || parse("#ffffff"));
    const result =
      alpha < 1
        ? {
            mode: "rgb",
            r: c.r * alpha + b.r * (1 - alpha),
            g: c.g * alpha + b.g * (1 - alpha),
            b: c.b * alpha + b.b * (1 - alpha),
          }
        : c;
    return {
      hex: formatHex(result),
      composite:
        alpha < 1 ? { original: value, background: formatHex(b), alpha } : null,
    };
  } catch {
    return null;
  }
}
export const contrast = (a, b) => wcagContrast(a, b);
export function accessible(fg, bg, target = 4.5) {
  if (contrast(fg, bg) >= target) return { value: fg, derived: null };
  const original = lab(fg);
  let best = null;
  for (let i = 0; i <= 1000; i++) {
    const l = i / 1000;
    const v = formatHex({ ...original, l });
    if (
      contrast(v, bg) >= target &&
      (!best || Math.abs(l - original.l) < Math.abs(best.l - original.l))
    )
      best = { value: v, l };
  }
  if (!best) throw Error("Cannot reach requested contrast");
  return {
    value: best.value,
    derived: { from: fg, op: "lightness", delta: best.l - original.l },
  };
}
