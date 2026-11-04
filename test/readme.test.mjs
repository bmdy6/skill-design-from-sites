import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const languages = [
  ['README.md', '', ['What you get', 'Quick start', 'How it works', 'Traceability in 10 lines', 'Commands / options', 'FAQ / limitations', 'License']],
  ['README.zh-CN.md', '.zh-CN', ['你会得到什么', '快速开始', '工作流程', '十行看懂来源追溯', '命令与选项', '常见问题与限制', '许可证']],
];

test('READMEs mirror the result-first structure and retain scope boundaries', async () => {
  for (const [file, , headings] of languages) {
    const text = await fs.readFile(file, 'utf8');
    assert.deepEqual([...text.matchAll(/^## (.+)$/gm)].map(m => m[1]), headings);
    for (const forbidden of ['dembrandt', 'getdesign', 'superdesign', 'Lucide', 'Playwright', 'Chromium']) {
      assert.ok(!text.toLowerCase().includes(forbidden.toLowerCase()), `${file}: ${forbidden}`);
    }
    assert.doesNotMatch(text, /Original style \d/i);
    for (const field of ['"selector"', '"stylesheet"', '"line"', 'sources.json']) assert.ok(text.includes(field), field);
    assert.ok(text.includes('npx skills add bmdy6/skill-design-from-sites'));
    assert.ok(!text.includes('OWNER/REPO'));
    const links = [...text.matchAll(/\]\(((?!https?:)[^)#]+)/g), ...text.matchAll(/(?:href|src|srcset)="((?!https?:|#)[^"#]+)/g)].map(m => m[1]);
    assert.ok(links.length > 5);
    for (const link of links) await fs.access(link);
  }
  const en = await fs.readFile('README.md', 'utf8');
  for (const phrase of ['Only collects public pages', 'Copyright and trademark', 'not legal advice']) assert.ok(en.includes(phrase));
  const zh = await fs.readFile('README.zh-CN.md', 'utf8');
  for (const phrase of ['只采集公开页面', '版权和商标说明', '非法律意见']) assert.ok(zh.includes(phrase));
});

test('every README picture has localized light/dark 2x art, alt text and a caption', async () => {
  const referenced = new Set();
  for (const [file, locale] of languages) {
    const text = await fs.readFile(file, 'utf8');
    const pictures = [...text.matchAll(/<picture>([\s\S]*?)<\/picture>\s*\n\n([^\n]+)/g)];
    assert.equal(pictures.length, 4, file);
    for (const [, markup, caption] of pictures) {
      assert.ok(caption.trim().length > 10);
      assert.match(markup, /media="\(prefers-color-scheme: dark\)"/);
      assert.match(markup, /alt="[^"]{10,}"/);
      assert.match(markup, /width="900"/);
      for (const theme of ['light', 'dark']) {
        const art = markup.match(new RegExp(`docs/readme/[^" ]+-${theme}${locale.replace('.', '\\.')}\\.png`))?.[0];
        assert.ok(art, `${file}: missing ${theme}${locale}`);
        referenced.add(art.replace('docs/readme/', ''));
        const png = await fs.readFile(art);
        assert.equal(png.subarray(1, 4).toString(), 'PNG');
        assert.equal(png.readUInt32BE(16), 1800, `${art}: must render at 2x`);
      }
    }
  }
  const generated = (await fs.readdir('docs/readme')).filter(f => f.endsWith('.png'));
  assert.deepEqual(generated.sort(), [...referenced].sort(), 'no orphan artwork');
});
