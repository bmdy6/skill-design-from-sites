import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { cli, readJSON, writeJSON, exists, fail } from "./lib/io.mjs";
import { openBrowser } from "./lib/browser.mjs";
export async function saveFeedback(file, item) {
  const data = (await exists(file)) ? await readJSON(file) : { items: [] };
  const entry = {
    id: "fb-" + randomUUID(),
    page: item.page,
    viewport: item.viewport || "desktop",
    targetIds: item.targetIds,
    rect: item.rect || null,
    comment: item.comment || "",
    tasteSignal: item.tasteSignal || null,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  if (
    !entry.targetIds?.length ||
    entry.targetIds.some((id) => typeof id !== "string") ||
    typeof entry.comment !== "string"
  )
    fail("Invalid feedback");
  data.items.push(entry);
  await writeJSON(file, data);
  return entry;
}
export async function previewServer(o) {
  const root = await fs.realpath(o.dir);
  let queue = Promise.resolve();
  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (host !== `127.0.0.1:${server.address().port}`) {
        res.writeHead(403);
        res.end();
        return;
      }
      const u = new URL(req.url, "http://" + host);
      if (o.handle && (await o.handle(req, res, u))) return;
      if (u.pathname === "/__dfs/feedback" && req.method === "POST") {
        if (req.headers.origin && req.headers.origin !== u.origin)
          throw Error("Origin rejected");
        if (req.headers["content-type"] !== "application/json")
          throw Error("JSON required");
        let text = "";
        for await (const c of req) {
          text += c;
          if (text.length > 65536) throw Error("Body too large");
        }
        const item = JSON.parse(text);
        queue = queue
          .catch(() => {})
          .then(() => saveFeedback(o.feedback, item));
        const result = await queue;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end();
        return;
      }
      if (u.pathname === "/__dfs/overlay.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(
          await fs.readFile(new URL("./lib/overlay.js", import.meta.url)),
        );
        return;
      }
      let p = path.resolve(root, "." + decodeURIComponent(u.pathname));
      if ((await fs.stat(p)).isDirectory()) p = path.join(p, "index.html");
      p = await fs.realpath(p);
      if (!p.startsWith(root + path.sep)) throw Error("Outside root");
      let body = await fs.readFile(p);
      if (p.endsWith(".html"))
        body = body
          .toString()
          .replace(
            /<\/body>/i,
            '<script src="/__dfs/overlay.js"></script></body>',
          );
      res.setHeader(
        "Content-Type",
        p.endsWith(".html")
          ? "text/html"
          : p.endsWith(".css")
            ? "text/css"
            : p.endsWith(".js")
              ? "text/javascript"
              : p.endsWith(".webp")
                ? "image/webp"
                : p.endsWith(".jpg")
                  ? "image/jpeg"
                  : "application/octet-stream",
      );
      res.end(body);
    } catch (e) {
      res.statusCode = 400;
      res.end(e.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    host: "127.0.0.1",
    close: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  };
}
export async function locateFeedback(page, o) {
  return page.evaluate((o) => {
    const at = (x, y) =>
      document
        .elementsFromPoint(x, y)
        .filter((e) => !e.closest("#dfs-overlay"))
        .map((e) => e.closest("[data-ds-id]"))
        .find(Boolean);
    if (o.point) {
      const [x, y] = o.point.split(",").map(Number);
      const e = at(x, y);
      return e ? [e.dataset.dsId] : [];
    }
    const [x, y, w, h] = o.rect.split(",").map(Number),
      els = [];
    for (let i = 0; i <= 4; i++)
      for (let j = 0; j <= 4; j++) {
        const e = at(x + (w * i) / 4, y + (h * j) / 4);
        if (e) els.push(e);
      }
    let common = els[0];
    while (common && !els.every((e) => common.contains(e)))
      common = common.parentElement?.closest("[data-ds-id]");
    return common ? [common.dataset.dsId] : [];
  }, o);
}
export async function previewServe(o) {
  const s = await previewServer(o);
  if (o.point || o.rect) {
    let browser;
    try {
      ({ browser } = await openBrowser());
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      await page.goto(s.url + "/" + o.page);
      return await saveFeedback(o.feedback, {
        page: o.page,
        targetIds: await locateFeedback(page, o),
        rect: o.rect ? o.rect.split(",").map(Number) : null,
        comment: o.comment,
      });
    } finally {
      await browser?.close();
      await s.close();
    }
  }
  console.log(JSON.stringify({ url: s.url }));
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer"
        : "xdg-open";
  execFile(command, [s.url], () => {});
  return undefined;
}
cli(import.meta.url, previewServe);
