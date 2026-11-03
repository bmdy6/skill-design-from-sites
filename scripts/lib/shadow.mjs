import { parse } from "culori";
export function shadowValue(value) {
  const split = [];
  let start = 0,
    depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (value[i] === "," && depth === 0) {
      split.push(value.slice(start, i));
      start = i + 1;
    }
  }
  split.push(value.slice(start));
  const parsed = split.map((part) => {
    const colorMatch = part.match(
        /(?:rgba?|hsla?|oklch|oklab)\([^)]*\)|#[\da-f]{3,8}\b/i,
      ),
      named = part.split(/\s+/).find((s) => parse(s)),
      color = colorMatch?.[0] || named || "#000000";
    const remaining = part.replace(color, "");
    const lengths = [...remaining.matchAll(/(-?\d*\.?\d+)(px|rem)?\b/g)].map(
      (m) => ({ value: Number(m[1]), unit: m[2] || "px" }),
    );
    return {
      color,
      offsetX: lengths[0] || { value: 0, unit: "px" },
      offsetY: lengths[1] || { value: 0, unit: "px" },
      blur: lengths[2] || { value: 0, unit: "px" },
      spread: lengths[3] || { value: 0, unit: "px" },
      inset: /\binset\b/.test(part),
    };
  });
  return parsed.length === 1 ? parsed[0] : parsed;
}
