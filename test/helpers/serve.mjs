import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
export async function serve(root, responses = {}) {
  const requests = [];
  const base = path.resolve(root);
  const server = http.createServer(async (req, res) => {
    requests.push({ url: req.url, at: Date.now() });
    try {
      const file = path.resolve(
        base,
        "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
      );
      if (file !== base && !file.startsWith(base + path.sep))
        throw Error("path");
      const st = await fs.stat(file);
      const p = st.isDirectory() ? path.join(file, "index.html") : file;
      const types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(p)] || "application/octet-stream",
      );
      const response = responses[new URL(req.url, "http://local").pathname];
      res.statusCode = response?.status || 200;
      for (const [name, value] of Object.entries(response?.headers || {}))
        res.setHeader(name, value);
      res.end(await fs.readFile(p));
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  });
  await new Promise((r, j) => {
    server.once("error", j);
    server.listen(0, "127.0.0.1", r);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  };
}
