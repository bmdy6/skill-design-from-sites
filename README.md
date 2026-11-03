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

## 灵感来源与版权

灵感发现只请求画廊元数据，先检查 robots.txt，每次请求至少间隔两秒。源失败会降级为 seed URL 列表；请自行确认各画廊的服务条款，明确禁止自动访问的源应关闭。保守解析器不保证画廊改版后仍能读取列表。

候选原站允许在临时 context 加载素材以判断审美，只保存自己截取的首屏到 `~/.cache/design-from-sites/shots/`，30 天后由 doctor 清理。图片不进入用户项目或本仓库。对外分享用 `taste-share.md`，只有来源链接、文字与 CSS 色块。

`run.mjs taste` 串起 brief、发现/指定参考、截图、投票与 taste。确认审美后才进入 token 和设计稿；每个 gate 都写入 next.json，明确确认后才解锁依赖步骤。

## 两种模式与批准

从 `node scripts/run.mjs intake --mode personal --out .design-from-sites` 开始；每次把用户的一个真实答案传给 `--answer`，中断后沿用同一目录即可。个人模式最多五问。公司模式用 `--mode company`，逐项确认目标、用户、基准页面或代码、保持项、允许变更、外部灵感开关与审批人。

公司模式默认关闭外部灵感，结构固定来自 `baseline`。完成问答后确认 spec；老板偏好只能由用户提供，或由宿主在用户同意后起草并逐条确认。技能自己不读取宿主记忆和业务系统。然后运行 `run.mjs boss`、`run.mjs baseline`、`run.mjs taste`，依照 next.json 前进。用户明确选择无老板偏好时，用 `run.mjs boss --none` 记录这个决定。

用户确认 next.json 的问题后，宿主运行 `run.mjs approve --out DIR --gate NAME`；修改、否决和再投票不会解锁 gate。公司模式禁止跳过线框。需要老板确认的步骤由用户代为确认，记录 `user-on-behalf-of-boss`。`--approved` 的一致性批准文件是 `{token,value}` 数组，仅批准完全相同的值，不会沿用旧值的许可。

本地基准读取 CSS 变量、DTCG JSON 和静态 Tailwind theme，不执行配置代码；动态函数、插件或计算式需要改用静态 token 输入。相对单位保留原单位。仅能从 token 检查的审美轴与必须渲染 HTML 才能检查的轴分开报告，`unchecked` 不代表通过。

退出码：1 表示检查失败，2 表示输入或引用不合法，3 表示批准尚未取得。

## 本地复现

`node scripts/screenshots.mjs` 只用仓库原创 fixture 生成灵感看板、方案对比、圈改前后和分享页截图，默认写入 `docs/screenshots/`。此脚本不接受外部网站输入。浏览器受系统权限限制时，截图无法生成，也不据此认定视觉验收通过。

真实网络冒烟不进 CI，输出必须留在仓库外：`scripts/smoke-sites.mjs`、`scripts/smoke-galleries.mjs`、`scripts/smoke-browser.mjs`。开发验证使用 `npm test`，没有额外构建步骤。
