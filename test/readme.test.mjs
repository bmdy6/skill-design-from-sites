import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
test("README explains public scope, differentiation and rights boundaries", async () => {
  const en = await fs.readFile("README.md", "utf8");
  for (const s of [
    "How this project differs",
    "Copyright and trademark",
    "not legal advice",
    "Only collects public pages",
  ])
    assert.ok(en.includes(s), s);
  const zh = await fs.readFile("README.zh-CN.md", "utf8");
  for (const s of [
    "与已有项目的区别",
    "版权和商标说明",
    "非法律意见",
    "只采集公开页面",
  ])
    assert.ok(zh.includes(s), s);
});
test("README install command and links point at real targets", async () => {
  for (const f of ["README.md", "README.zh-CN.md"]) {
    const s = await fs.readFile(f, "utf8");
    assert.ok(!s.includes("OWNER/REPO"), f + " still has a placeholder");
    assert.ok(s.includes("npx skills add bmdy6/skill-design-from-sites"));
    for (const [, link] of s.matchAll(/\]\(((?!https?:)[^)#]+)/g))
      await fs.access(link);
  }
});
