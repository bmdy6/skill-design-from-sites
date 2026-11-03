import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
test("README explains public scope, differentiation and rights boundaries", async () => {
  const s = await fs.readFile("README.md", "utf8");
  for (const heading of [
    "与已有项目的区别",
    "版权和商标说明",
    "非法律意见",
    "只采集公开页面",
  ])
    assert.ok(s.includes(heading));
});
