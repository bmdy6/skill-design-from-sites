// Manual only: never run against public pages in CI; keep outputs outside the repository.
import path from "node:path";
import { cli, writeJSON } from "./lib/io.mjs";
import { collect } from "./collect.mjs";
import { extractRaw } from "./extract.mjs";
import { verifySources } from "./verify-sources.mjs";
export async function smoke(o) {
  const out = o.out || "/tmp/dfs-public-smoke",
    urls = [o.url].flat().filter(Boolean),
    results = [];
  for (const [i, url] of urls.entries()) {
    const dir = path.join(out, String(i)),
      id = "smoke";
    try {
      const raws = await collect({ url, "site-id": id, out: dir }),
        e = extractRaw(raws);
      await writeJSON(
        path.join(dir, "sources.json"),
        Object.fromEntries(
          Object.entries(e.samples)
            .filter(([, s]) => s.line && s.stylesheet)
            .map(([id, s]) => [id, { evidence: [s] }]),
        ),
      );
      const r = await verifySources({ run: dir, sample: 10, seed: 1 });
      results.push({
        url,
        status: r.passed === 10 ? "passed" : "failed",
        ...r,
      });
    } catch (e) {
      results.push({
        url,
        status: "blocked",
        reason: e.message.split("\n")[0],
      });
    }
  }
  await writeJSON(path.join(out, "results.json"), results);
  if (results.some((r) => r.status !== "passed")) process.exitCode = 1;
  return results;
}
cli(import.meta.url, smoke);
