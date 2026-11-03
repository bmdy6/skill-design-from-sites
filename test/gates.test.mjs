import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  pendingGate,
  approveGate,
  requireGate,
} from "../scripts/lib/gates.mjs";
test("declining a gate cannot unlock its dependent action", async () => {
  const run = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-gates-"));
  try {
    await pendingGate(run, "taste", "Confirm direction", ["approve", "revise"]);
    await approveGate(run, "taste", "revise");
    await assert.rejects(
      () => requireGate(run, "taste", "Confirm", ["approve", "revise"]),
      (e) => e.exitCode === 3,
    );
    await approveGate(run, "taste", "approve");
    assert.equal(
      (await requireGate(run, "taste", "Confirm", [])).approved,
      true,
    );
  } finally {
    await fs.rm(run, { recursive: true, force: true });
  }
});
