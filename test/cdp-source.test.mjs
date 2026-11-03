import { test } from "node:test";
import assert from "node:assert/strict";
import { declaration } from "../scripts/lib/cdp-source.mjs";
test("synthetic CDP longhands never displace authored source ranges", () => {
  const authored = {
    name: "background-color",
    value: "var(--primary)",
    text: "background-color: var(--primary);",
    range: { startLine: 11, startColumn: 2 },
  };
  assert.equal(
    declaration(
      {
        cssProperties: [
          authored,
          { name: "background-color", value: "rgb(37, 99, 235)" },
        ],
      },
      "background-color",
    ),
    authored,
  );
  const important = { ...authored, important: true };
  assert.equal(
    declaration(
      { cssProperties: [important, { ...authored, value: "red" }] },
      "background-color",
    ),
    important,
  );
});
