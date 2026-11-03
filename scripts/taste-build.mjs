import { applyBoss } from "./boss-taste.mjs";
import path from "node:path";
import { cli, readJSON, writeJSON, write, fail } from "./lib/io.mjs";
export const axisAspects = {
  bgL: "color",
  accentChroma: "color",
  radiusPx: "layout",
  basePx: "type",
  headingRatio: "type",
  "fontClass.serif": "type",
  "fontClass.sans": "type",
  "fontClass.mono": "type",
  "fontClass.display": "type",
  density: "layout",
  whitespace: "whitespace",
  imagery: "imagery",
  "motion.animations": "motion",
  "motion.keyframes": "motion",
};
const get = (o, p) => p.split(".").reduce((a, k) => a?.[k], o),
  mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1),
  clamp = (x) => Math.max(-1, Math.min(1, x));
function percentile(values, p) {
  const a = [...values].sort((a, b) => a - b);
  const i = (a.length - 1) * p,
    l = Math.floor(i);
  return a[l] + (a[Math.ceil(i)] - a[l]) * (i - l);
}
export function validateRules(rules, taste, votes) {
  const ids = new Set(votes.items.map((v) => v.cid));
  for (const r of rules)
    if (
      !taste.axes[r.axis] ||
      !r.evidence?.length ||
      r.evidence.some((id) => !ids.has(id))
    )
      fail("Rule references unknown axis or unvoted candidate");
  return rules;
}
export function tasteBuild(captures, votes, options = {}) {
  const items = votes.items.filter(
      (v) =>
        captures.captures.some((c) => c.cid === v.cid) && v.vote !== "skip",
    ),
    axes = {};
  for (const [axis, aspect] of Object.entries(axisAspects)) {
    const affected = items.filter(
        (v) => !v.aspects.length || v.aspects.includes(aspect),
      ),
      measure = (v) =>
        get(captures.captures.find((c) => c.cid === v.cid).fp, axis),
      all = affected.map(measure).filter(Number.isFinite),
      likes = affected
        .filter((v) => v.vote === "like")
        .map(measure)
        .filter(Number.isFinite),
      dislikes = affected
        .filter((v) => v.vote === "dislike")
        .map(measure)
        .filter(Number.isFinite);
    if (!likes.length) continue;
    const avg = mean(all),
      std = Math.sqrt(mean(all.map((x) => (x - avg) ** 2)));
    const strength = std
      ? clamp((mean(likes) - (dislikes.length ? mean(dislikes) : avg)) / std)
      : 0;
    axes[axis] = {
      range: [percentile(likes, 0.1), percentile(likes, 0.9)],
      strength,
    };
  }
  if (axes.bgL) {
    const dark = axes.bgL.range.reduce((a, b) => a + b, 0) / 2 < 0.5;
    axes.theme = {
      prefer: dark ? "dark" : "light",
      strength: Math.abs(axes.bgL.strength),
    };
  }
  const liked = items.filter((v) => v.vote === "like");
  const score = (c, aspect) =>
    liked.filter(
      (v) =>
        v.cid === c.cid &&
        (!aspect || !v.aspects.length || v.aspects.includes(aspect)),
    ).length;
  const references = [];
  for (const [role, aspect] of [
    ["primary", null],
    ["color", "color"],
    ["type", "type"],
  ]) {
    const ranked = captures.captures
      .filter((c) => liked.some((v) => v.cid === c.cid))
      .sort(
        (a, b) =>
          score(b, aspect) - score(a, aspect) || a.cid.localeCompare(b.cid),
      );
    if (ranked[0])
      references.push({ cid: ranked[0].cid, url: ranked[0].url, role });
  }
  const rounds = Math.max(0, ...votes.items.map((v) => v.round || 1)),
    low =
      items.length < 6 ||
      Object.values(axes).every((a) => Math.abs(a.strength) < 0.3);
  const taste = {
    schemaVersion: 1,
    owner: options.owner || "self",
    rounds,
    likes: [...new Set(liked.map((v) => v.cid))].sort(),
    dislikes: [
      ...new Set(items.filter((v) => v.vote === "dislike").map((v) => v.cid)),
    ].sort(),
    axes,
    references,
    rules: [],
    confidence: low ? "low" : "high",
    history: options.history || [],
  };
  taste.rules = validateRules(options.rules || [], taste, votes);
  return options.boss ? applyBoss(taste, options.boss) : taste;
}
export async function tasteBuildFile(o) {
  if (o["append-feedback"]) {
    const taste = appendFeedback(
      await readJSON(o.out),
      await readJSON(o["append-feedback"]),
    );
    await writeJSON(o.out, taste);
    return taste;
  }
  const captures = await readJSON(o.captures),
    votes = await readJSON(o.votes),
    taste = tasteBuild(captures, votes, {
      owner: o.owner,
      boss: o.boss ? await readJSON(o.boss) : null,
      rules: o.rules ? await readJSON(o.rules) : [],
    });
  await writeJSON(o.out, taste);
  await write(
    path.join(path.dirname(o.out), "taste.md"),
    `# 审美取向\n\nConfidence: ${taste.confidence}\n\n` +
      (taste.conflicts || [])
        .map(
          (c) =>
            "Conflict: " + c.axis + " — " + c.reason + " (" + c.basis.ref + ")",
        )
        .join("\n") +
      "\n" +
      taste.rules
        .map((r) => `- ${r.text} (${r.axis}: ${r.evidence.join(", ")})`)
        .join("\n") +
      "\n",
  );
  return taste;
}
cli(import.meta.url, tasteBuildFile);

export function appendFeedback(taste, feedback) {
  const next = structuredClone(taste);
  if (
    !feedback.tasteSignal ||
    next.history.some((h) => h.feedback === feedback.id)
  )
    return next;
  const { axis, direction } = feedback.tasteSignal;
  if (!next.axes[axis]) fail("Unknown taste feedback axis");
  const sign = ["increase", "lighter", 1].includes(direction)
    ? 1
    : ["decrease", "darker", -1].includes(direction)
      ? -1
      : 0;
  if (!sign) fail("Unknown taste feedback direction");
  const rule = next.axes[axis];
  if (rule.range) {
    const movement =
      Math.max(
        Math.abs(rule.range[1] - rule.range[0]),
        Math.abs(rule.range[1]) * 0.1,
        1,
      ) *
      0.1 *
      sign;
    rule.range = rule.range.map((n) => Math.max(0, n + movement));
  } else if (axis === "theme") rule.prefer = sign > 0 ? "light" : "dark";
  rule.strength = Math.max(0.5, Math.abs(rule.strength));
  next.history.push({ feedback: feedback.id, axis, direction });
  return next;
}
