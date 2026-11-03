# skill-design-from-sites
从你喜欢的网站提取带出处的设计规范，先摸清审美再出设计稿 | Agent skill: design tokens with provenance, taste-first design drafts

Node ≥20，ESM，无构建步骤。安装：`npm ci`，运行 `node scripts/doctor.mjs --json` 自动补齐 Chromium。可通过 `npx skills add OWNER/REPO` 安装技能；命令中的地址替换为本仓库地址。

只采集公开页面；不会读取登录态、cookie、浏览器原有 profile、agent 记忆或内部系统。单页两个视口，不爬整站。正式采集在请求层拦截图片、字体、SVG、logo、视频。预览只用原创占位块与本地 Lucide 图标。

## 使用

阅读 [SKILL.md](SKILL.md)。基础命令：

```sh
node scripts/run.mjs extract --url PUBLIC_URL --out .design-from-sites
# 宿主 agent 按 next.json 用已有 evidence ID 写 labels
node scripts/run.mjs tokens --out .design-from-sites
node scripts/check.mjs --tokens .design-from-sites/tokens.json --paths src --format json
npm test
```

产物默认放用户项目的 `.design-from-sites/`，建议加入 `.gitignore`。本仓库的测试与示例只用原创 fixture。真实站点冒烟结果和截图不进入本仓库。

## 与已有项目的区别

- dembrandt 提供品牌提取与 token 导出；本项目自行用 Playwright/CDP 采集，记录 selector 和样式表的行列位置，没有复用其实现。
- getdesign / design.md 侧重给 agent 的设计文档；本项目把数值证据与语义命名分离，模型只能引用已有 ID，并重新打开页面验证来源。
- superdesign 提供多个方案的交互思路；本项目用本地页面与显式 gate 完成选择和局部圈改，无托管服务依赖。

## 版权和商标说明（非法律意见）

提取公开页面的计算样式，不意味着获得设计、商标、图片或字体的使用授权。请自行确认目标页面的使用条款与适用规则。不复制 logo、文案、图片、字体文件和完整页面。对外材料只放来源链接、自己的说明及 token 色块。

## 验证与限制

`npm test` 使用 node:test，浏览器测试需要允许启动 Chromium 的本机环境。CSSOM 动态规则可能没有可验证的行号；来源不足时保留低置信度，不伪造位置。站点更新、条件样式、动画及字体替换可能造成复核失败；应重新采集后审阅差异。
