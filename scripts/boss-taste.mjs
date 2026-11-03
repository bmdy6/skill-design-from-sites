import { cli, readJSON, writeJSON, fail } from "./lib/io.mjs";
export function confirmBoss(draft, decisions) {
  const items = structuredClone(draft.items || []);
  const byId = new Map();
  for (const part of decisions.split(";").filter(Boolean)) {
    const m = part.match(/^([\w-]+)=(keep|drop|edit)(?::([\s\S]+))?$/);
    if (!m) fail("Expected id=keep, id=drop or id=edit:text");
    const item = items.find((i) => i.id === m[1]) || items[Number(m[1]) - 1];
    if (!item) fail("Unknown draft item");
    if (m[2] === "edit" && !m[3]) fail("Edited text required");
    byId.set(item.id, { op: m[2], text: m[3] });
  }
  return {
    items: items
      .filter((i) => byId.get(i.id)?.op !== "drop")
      .map((i) => {
        if (!["user", "agent-memory"].includes(i.source))
          fail("Owner taste requires a declared source");
        const d = byId.get(i.id);
        return {
          ...i,
          confirmed: !!d,
          editedByUser: d?.op === "edit",
          ...(d?.op === "edit" ? { text: d.text } : {}),
        };
      }),
  };
}
export function applyBoss(taste, boss) {
  const next = structuredClone(taste);
  next.conflicts ??= [];
  for (const item of boss.items || []) {
    if (!item.confirmed || !item.axis) continue;
    const text = item.text.toLowerCase(),
      positive = item.polarity === "like";
    let axis = item.axis,
      rule;
    if (
      ["theme", "color"].includes(axis) &&
      /dark|light|深色|浅色/.test(text)
    ) {
      const dark = /dark|深色/.test(text),
        prefer = positive === dark ? "dark" : "light";
      axis = "theme";
      rule = { prefer, strength: 1 };
      next.axes.bgL = {
        range: prefer === "dark" ? [0, 0.49] : [0.5, 1],
        strength: prefer === "dark" ? -1 : 1,
      };
    } else if (
      ["radiusPx", "layout"].includes(axis) &&
      /round|square|rounded|直角|圆角/.test(text)
    ) {
      const square = /square|直角/.test(text),
        straight = positive === square;
      axis = "radiusPx";
      rule = {
        range: straight ? [0, 4] : [8, 48],
        strength: straight ? -1 : 1,
      };
    } else if (axis === "density" && /dense|sparse|紧凑|稀疏/.test(text)) {
      const dense = /dense|紧凑/.test(text);
      rule = {
        range: positive === dense ? [0.5, 1] : [0, 0.5],
        strength: positive === dense ? 1 : -1,
      };
    }
    if (!rule) continue;
    const before = next.axes[axis];
    if (before && JSON.stringify(before) !== JSON.stringify(rule))
      next.conflicts.push({
        axis,
        before,
        after: rule,
        basis: { kind: "boss", ref: item.id },
        reason: "Confirmed boss preference takes priority over votes",
      });
    next.axes[axis] = { ...rule, basis: [{ kind: "boss", ref: item.id }] };
  }
  return next;
}
export async function bossTaste(o) {
  if (o._[0] !== "confirm") fail("Expected confirm");
  const result = confirmBoss(await readJSON(o.draft), o.decisions || "");
  await writeJSON(o.out || o.draft.replace(/\.draft\.json$/, ".json"), result);
  return result;
}
cli(import.meta.url, bossTaste);
