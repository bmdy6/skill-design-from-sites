import { test } from "node:test";
import assert from "node:assert/strict";
import { navigateForCollection } from "../scripts/lib/navigation.mjs";

test("collection proceeds after bounded network-idle timeout", async () => {
  const calls = [];
  const page = {
    goto: async (...args) => calls.push(["goto", ...args]),
    waitForLoadState: async (...args) => {
      calls.push(["settle", ...args]);
      throw Object.assign(Error("persistent requests"), {
        name: "TimeoutError",
      });
    },
  };
  await navigateForCollection(page, "https://example.test");
  assert.deepEqual(calls, [
    [
      "goto",
      "https://example.test",
      { waitUntil: "domcontentloaded", timeout: 25000 },
    ],
    ["settle", "networkidle", { timeout: 3000 }],
  ]);
});

test("navigation errors and closed pages still fail", async () => {
  await assert.rejects(
    navigateForCollection(
      {
        goto: async () => {
          throw Error("navigation failed");
        },
      },
      "x",
    ),
    /navigation failed/,
  );
  await assert.rejects(
    navigateForCollection(
      {
        goto: async () => {},
        waitForLoadState: async () => {
          throw Error("page closed");
        },
      },
      "x",
    ),
    /page closed/,
  );
});
