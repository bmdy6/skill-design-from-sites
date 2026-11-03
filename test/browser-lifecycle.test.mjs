import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  cleanupExternal,
  sandboxArgs,
} from "../scripts/lib/browser-lifecycle.mjs";

function childProcess() {
  const child = new EventEmitter();
  child.pid = 12345;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = (signal) => {
    setTimeout(() => {
      child.signalCode = signal;
      child.emit("exit", null, signal);
    }, 10);
    return true;
  };
  return child;
}

test("external browser disables sandbox only for Linux root", () => {
  assert.deepEqual(sandboxArgs("linux", 0), ["--no-sandbox"]);
  for (const [platform, uid] of [
    ["linux", 1000],
    ["darwin", 0],
    ["win32", undefined],
  ])
    assert.deepEqual(sandboxArgs(platform, uid), []);
});

test("profile cleanup waits for exit and retries directory races", async () => {
  const child = childProcess();
  let attempts = 0;
  await cleanupExternal(child, "/unused", {
    retryDelay: 1,
    remove: async () => {
      assert.ok(child.signalCode, "must exit before removing profile");
      if (++attempts < 3)
        throw Object.assign(Error("busy"), { code: "ENOTEMPTY" });
    },
    warn: () => assert.fail("cleanup should recover"),
  });
  assert.equal(attempts, 3);
});

test("exhausted cleanup warns once without failing the caller", async () => {
  const warnings = [];
  let attempts = 0;
  await cleanupExternal(childProcess(), "/unused", {
    retryDelay: 1,
    remove: async () => {
      attempts++;
      throw Error("still busy");
    },
    warn: (message) => warnings.push(message),
  });
  assert.equal(attempts, 4);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /warning.*profile.*still busy/i);
});

test("stubborn browser is killed and profile is retained if exit is unconfirmed", async () => {
  const child = childProcess(),
    signals = [],
    warnings = [];
  child.kill = (signal) => {
    signals.push(signal);
    return true;
  };
  await cleanupExternal(child, "/unused", {
    timeoutMs: 5,
    remove: () => assert.fail("must retain profile while process may be alive"),
    warn: (message) => warnings.push(message),
  });
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(warnings.length, 1);
  assert.equal(child.listenerCount("exit"), 0);
});

test("failed spawn has no live process and can clean immediately", async () => {
  const child = childProcess();
  child.pid = undefined;
  child.kill = () => assert.fail("no process to kill");
  let removed = false;
  await cleanupExternal(child, "/unused", {
    remove: async () => {
      removed = true;
    },
    warn: () => assert.fail("cleanup should succeed"),
  });
  assert.equal(removed, true);
});

test("real process finishes its shutdown write before profile removal", async () => {
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dfs-exit-test-"));
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
    process.on("SIGTERM", () => setTimeout(() => {
      require("node:fs").writeFileSync(process.argv[1] + "/last-write", "finished");
      process.exit(0);
    }, 40));
    process.send("ready");
    setInterval(() => {}, 1000);
  `,
      dir,
    ],
    { stdio: ["ignore", "ignore", "inherit", "ipc"] },
  );
  try {
    await new Promise((resolve, reject) => {
      child.once("message", resolve);
      child.once("error", reject);
      child.once("exit", () => reject(Error("exited before ready")));
    });
    await cleanupExternal(child, dir, {
      remove: async (profile, options) => {
        assert.equal(child.exitCode, 0);
        assert.equal(
          await fs.readFile(path.join(profile, "last-write"), "utf8"),
          "finished",
        );
        await fs.rm(profile, options);
      },
      warn: () => assert.fail("real shutdown should succeed"),
    });
    await assert.rejects(fs.stat(dir), { code: "ENOENT" });
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    await fs.rm(dir, { recursive: true, force: true });
  }
});
