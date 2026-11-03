import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
test("doctor reports usable dependencies and browser", () => {
  const d = JSON.parse(
    execFileSync(process.execPath, ["scripts/doctor.mjs", "--json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(d.ok, true);
  assert.ok(d.steps.some((s) => s.name === "chromium"));
});

test("doctor expires only old screenshot files", async () => {
  const fs = await import("node:fs/promises"),
    os = await import("node:os"),
    path = await import("node:path");
  const { cleanShots } = await import("../scripts/doctor.mjs");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-clean-"));
  try {
    await fs.writeFile(path.join(dir, "old.jpg"), "fixture");
    await fs.writeFile(path.join(dir, "fresh.webp"), "fixture");
    await fs.writeFile(path.join(dir, "keep.json"), "{}");
    await fs.utimes(path.join(dir, "old.jpg"), new Date(0), new Date(0));
    await fs.utimes(path.join(dir, "keep.json"), new Date(0), new Date(0));
    assert.equal(await cleanShots(dir), 1);
    assert.deepEqual((await fs.readdir(dir)).sort(), [
      "fresh.webp",
      "keep.json",
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
