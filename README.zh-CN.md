<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/banner-dark.png">
    <img alt="design-from-sites" src="docs/readme/banner-light.png" width="520">
  </picture>
</p>

<h3 align="center">把你喜欢的网站，变成一套能追溯出处的设计规范。</h3>

<p align="center">
  <a href="https://github.com/bmdy6/skill-design-from-sites/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/bmdy6/skill-design-from-sites/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node ≥ 20" src="https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white">
  <img alt="Agent skill" src="https://img.shields.io/badge/agent-skill-6E56CF">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <br>
  <a href="#快速开始"><b>快速开始</b></a> ·
  <a href="#怎么用">怎么用</a> ·
  <a href="SKILL.md">SKILL.md</a> ·
  <a href="docs/reference.zh-CN.md">参考手册</a> ·
  <a href="README.md">English</a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.png">
  <img alt="左边是 tokens.json，右边是 main.css：每个 token 都连到它来自的那一行，并会重新打开页面复核来源" src="docs/readme/hero-light.png">
</picture>

## 快速开始

```sh
npx skills add bmdy6/skill-design-from-sites
```

然后对你的 agent 说：

> 用 design-from-sites。这两个网站的感觉我喜欢：`<网址1>` `<网址2>`。帮我摸清审美，出一版落地页。

<sub>需要 Node ≥ 20 · 不需要 API key · 没有托管服务 · 用 Playwright + Chromium 在本地运行</sub>

## 怎么用

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/workflow-dark.png">
  <img alt="1. 给参考站投票  2. 对比三种布局  3. 圈出一处再修改" src="docs/readme/workflow-light.png">
</picture>

先定审美，再出 token，最后才写代码。每一步都要你明确点头才会继续。

## 为什么用它

- **token 有出处。** 每个颜色、字号、圆角和阴影都记着 selector 和样式表的 `行:列`。生成后会重新打开页面，抽样复核来源。
- **模型只命名，不编数值。** 数值来自实测证据，agent 只能把名字对应到已有的证据 ID。引用不存在的 ID，构建会直接失败。
- **不复制素材。** 采集时拦截图片、字体、logo、SVG 和视频请求；预览只用原创占位和本地 Lucide 图标。

## 与已有项目的区别

| | 侧重 | 本项目 |
|---|---|---|
| dembrandt | 品牌提取与 token 导出 | 自己用 Playwright/CDP 采集，记录 selector 和行列 |
| getdesign / design.md | 给 agent 用的设计文档 | 证据和命名分开存放，来源会重新核对 |
| superdesign | 多方案的交互探索 | 本地页面加显式确认，不依赖托管服务 |

## 不装 agent 也能试

```sh
git clone https://github.com/bmdy6/skill-design-from-sites && cd skill-design-from-sites
npm ci
node scripts/doctor.mjs --json     # 缺 Chromium 时自动安装
node scripts/run.mjs extract --url https://example.com --out .design-from-sites
```

`extract` 会在桌面和手机两个宽度下测量页面，然后停在 `.design-from-sites/next.json`，之后交给 agent。生成 token 后，可以用它检查你自己的 CSS：

```sh
node scripts/check.mjs --tokens .design-from-sites/tokens.json --paths src --format json
```

每个偏离 token 的值都会附上 `文件:行`、最接近的 token 和一个建议的 `var(--…)` 替换；有发现时退出码为 1。

## 个人模式和公司模式

- **个人**（`--mode personal`）：最多问五个问题，然后依次定审美 → 出 token → 出设计稿。
- **公司**（`--mode company`）：以现有页面或代码为基准；外部灵感默认关闭，不能跳过线框，老板偏好只能由你提供。

全部命令、确认步骤和退出码见[参考手册](docs/reference.zh-CN.md)。参与开发请运行 `npm test`；要从 fixture 重新生成 README 图片，运行 `node scripts/readme-art.mjs`。

---

<p align="center"><sub>MIT 许可证 · 只采集公开页面，不复制 logo、字体和图片 · <a href="docs/reference.zh-CN.md#版权和商标说明非法律意见">版权和商标说明（非法律意见）</a></sub></p>
