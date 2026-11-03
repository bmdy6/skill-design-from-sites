export async function setupCDP(context, page) {
  const session = await context.newCDPSession(page);
  const headers = new Map();
  session.on("CSS.styleSheetAdded", ({ header }) =>
    headers.set(header.styleSheetId, header),
  );
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  return { session, headers };
}
export function declaration(style, property) {
  const properties = (style?.cssProperties || [])
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => !p.disabled && p.parsedOk !== false && !p.implicit);
  const authored = properties.filter(({ p }) => p.range || p.text);
  // CDP appends synthetic longhands without source ranges. They cannot replace
  // an authored declaration, even when their names match exactly.
  const candidates = (authored.length ? authored : properties).filter(
    ({ p }) =>
      p.name === property ||
      p.longhandProperties?.some((l) => l.name === property),
  );
  candidates.sort(
    (a, b) =>
      Number(!!b.p.important) - Number(!!a.p.important) || b.index - a.index,
  );
  return candidates[0]?.p || null;
}
export async function sourceFor(cdp, selector, property) {
  const { session, headers } = cdp;
  const { result } = await session.send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)})`,
    objectGroup: "dfs",
  });
  if (!result.objectId) return null;
  try {
    await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.requestNode", {
      objectId: result.objectId,
    });
    const m = await session.send("CSS.getMatchedStylesForNode", { nodeId });
    let candidates = [];
    const add = (style, origin, ruleSelector, order) => {
      const p = declaration(style, property);
      if (p) candidates.push({ p, style, origin, ruleSelector, order });
    };
    add(m.inlineStyle, "inline", selector, 1e6);
    for (const [i, x] of (m.matchedCSSRules || []).entries())
      add(
        x.rule.style,
        x.rule.origin,
        x.rule.selectorList?.text || selector,
        i,
      );
    if (!candidates.length)
      for (const ancestor of m.inherited || []) {
        add(ancestor.inlineStyle, "inherited", selector, 1e6);
        for (const [i, x] of (ancestor.matchedCSSRules || []).entries())
          add(
            x.rule.style,
            "inherited",
            x.rule.selectorList?.text || selector,
            i,
          );
        if (candidates.length) break;
      }
    candidates.sort(
      (a, b) =>
        Number(b.p.important || false) - Number(a.p.important || false) ||
        b.order - a.order,
    );
    const c = candidates[0];
    if (!c)
      return {
        origin: "user-agent",
        ruleSelector: selector,
        authoredValue: "",
        stylesheet: "",
        line: null,
        column: null,
      };
    const h = headers.get(c.style.styleSheetId);
    const range = c.p.range || c.style.range;
    const cssom =
      !["inline", "user-agent"].includes(c.origin) && (!h || !h.sourceURL);
    const authored = c.p.text?.includes(":")
      ? c.p.text
          .slice(c.p.text.indexOf(":") + 1)
          .replace(/;\s*$/, "")
          .replace(/!important\s*$/i, "")
          .trim()
      : c.p.value;
    const located = !cssom && c.origin !== "user-agent" && range;
    return {
      origin: cssom ? "cssom" : c.origin,
      ruleSelector: c.ruleSelector,
      authoredValue: authored,
      stylesheet: h?.sourceURL || "",
      line: located ? (h?.startLine || 0) + range.startLine + 1 : null,
      column: located
        ? range.startColumn +
          1 +
          (range.startLine === 0 ? h?.startColumn || 0 : 0)
        : null,
    };
  } finally {
    await session.send("Runtime.releaseObjectGroup", { objectGroup: "dfs" });
  }
}
