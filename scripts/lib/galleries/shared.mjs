import { htmlTree, walk, attr } from "../html.mjs";
export function parseGallery(html, base) {
  try {
    if (typeof html !== "string") return [];
    const rows = [];
    const models = new Map();
    const tree = htmlTree(html);
    walk(tree, (n) => {
      const encoded = attr(n, "data-collectable-model-value");
      if (encoded)
        try {
          const model = JSON.parse(encoded);
          if (model.slug && model.title) models.set(model.slug, model);
        } catch {}
    });
    const origin = new URL(base).hostname;
    const text = (n) =>
      n.nodeName === "#text"
        ? n.value
        : (n.childNodes || []).map(text).join("");
    walk(tree, (n) => {
      if (n.tagName !== "a") return;
      const explicit = attr(n, "data-site-url") || attr(n, "data-url"),
        slug = attr(n, "data-visit-count-identifier-value"),
        model = slug ? models.get(slug) : null;
      if (!explicit && !model) return;
      const candidate =
        attr(n, "data-site-url") || attr(n, "data-url") || attr(n, "href");
      if (!candidate) return;
      const u = new URL(candidate, base);
      if (!["https:", "http:"].includes(u.protocol) || u.hostname === origin)
        return;
      if (
        /(?:facebook|instagram|twitter|youtube|linkedin|pinterest)\.com$/.test(
          u.hostname,
        )
      )
        return;
      const title = (model?.title || attr(n, "title") || text(n)).trim();
      if (!title) return;
      const tags =
        model?.tags ||
        (attr(n, "data-tags") || "").split(/[,\s]+/).filter(Boolean);
      for (const raw of [...tags]) {
        const value = String(raw).toLowerCase();
        if (/dark/.test(value)) tags.push("dark");
        if (/light/.test(value)) tags.push("light");
        if (/sans/.test(value)) tags.push("sans");
        else if (/serif/.test(value)) tags.push("serif");
      }
      rows.push({
        siteUrl: u.href,
        host: u.hostname,
        title,
        tags: [...new Set(tags)],
        galleryUrl: model
          ? new URL("/sites/" + model.slug, base).href
          : new URL(attr(n, "href") || base, base).href,
      });
    });
    return rows;
  } catch {
    return [];
  }
}
export async function adapter(name, url, fetchText) {
  try {
    return {
      name,
      status: "ok",
      items: parseGallery(await fetchText(url), url),
    };
  } catch (e) {
    return { name, status: "failed", items: [], detail: e.message };
  }
}
