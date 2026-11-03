# Reference

> 中文版：[reference.zh-CN.md](reference.zh-CN.md). Overview: [README](../README.md).

## Install and scope

Node ≥ 20, ESM, no build step. Install with `npm ci`, then run `node scripts/doctor.mjs --json`, which installs Chromium if missing. To install as an agent skill, run `npx skills add bmdy6/skill-design-from-sites`.

Only public pages are collected. The skill never reads logged-in sessions, cookies, an existing browser profile, agent memory or internal systems. It measures one page at two viewports and never crawls a site. During collection, image, font, SVG, logo and video requests are blocked at the request layer. Previews use only original placeholder blocks and local Lucide icons.

## Usage

Read [SKILL.md](../SKILL.md). Core commands:

```sh
node scripts/run.mjs extract --url PUBLIC_URL --out .design-from-sites
# the host agent writes labels from next.json, citing existing evidence IDs only
node scripts/run.mjs tokens --out .design-from-sites
node scripts/check.mjs --tokens .design-from-sites/tokens.json --paths src --format json
npm test
```

Output goes to `.design-from-sites/` in the user's project by default; add it to `.gitignore`. Tests and examples in this repository use only original fixtures. Real-site smoke results and screenshots never enter the repository.

## How this differs from existing projects

- **dembrandt** does brand extraction and token export. This project collects with its own Playwright/CDP code, records the selector and the stylesheet line/column, and reuses none of dembrandt's implementation.
- **getdesign / design.md** focus on design documents for agents. This project keeps numeric evidence apart from semantic naming: the model can only cite existing IDs, and the page is reopened to verify sources.
- **superdesign** explores multiple design options interactively. This project chooses between options and revises one part at a time using local pages and explicit gates, with no hosted service.

## Copyright and trademark (not legal advice)

Extracting computed styles from a public page does not grant any right to its design, trademarks, images or fonts. Check the target page's terms and the rules that apply to you. Logos, copy text, images, font files and whole pages are never copied. Shareable material contains only source links, your own notes and token color swatches.

## Verification and limits

`npm test` uses node:test. Browser tests need a local environment that can launch Chromium. Dynamic CSSOM rules may have no verifiable line number. When a source is insufficient, the record stays low-confidence and no location is invented. Site updates, conditional styles, animation and font substitution can make re-verification fail. When that happens, collect again and review the diff.

## Inspiration sources and copyright

Discovery requests only gallery metadata. It checks robots.txt first and waits at least two seconds between requests. If a source fails, discovery falls back to the seed URL list. Check each gallery's terms of service yourself, and turn off any source that forbids automated access. The conservative parser may stop working when a gallery changes its layout.

Candidate sites may load their assets in a temporary context so you can judge taste. Only the skill's own above-the-fold screenshots are kept, in `~/.cache/design-from-sites/shots/`, and doctor removes them after 30 days. Images never enter the user's project or this repository. For sharing, use `taste-share.md`, which contains only source links, text and CSS swatches.

`run.mjs taste` chains together the brief, discovery or chosen references, screenshots, votes and the taste build. Tokens and drafts start only after the taste is confirmed. Every gate is written to next.json, and a dependent step unlocks only after explicit confirmation.

## Modes and approvals

Start with `node scripts/run.mjs intake --mode personal --out .design-from-sites`. Pass one real user answer per call with `--answer`. If the run is interrupted, reuse the same directory. Personal mode asks at most five questions. Company mode (`--mode company`) confirms each of these in turn: goal, users, baseline page or code, what must stay, what may change, whether external inspiration is allowed, and the approver.

Company mode turns external inspiration off by default and always takes structure from the `baseline`. After intake, confirm the spec. Owner preferences come only from the user, or from a draft the host prepares with the user's consent and confirms item by item. The skill itself never reads host memory or business systems. Then run `run.mjs boss`, `run.mjs baseline` and `run.mjs taste`, following next.json. If the user explicitly chooses to have no owner preferences, record that with `run.mjs boss --none`.

Once the user confirms the question in next.json, the host runs `run.mjs approve --out DIR --gate NAME`. Edits, rejections and re-votes do not unlock a gate. Company mode never skips wireframes. When a step needs the owner's confirmation, the user confirms on their behalf, and the record says `user-on-behalf-of-boss`. The consistency approval file passed to `--approved` is an array of `{token,value}` objects. It approves only identical values and never carries over approval for an old value.

The local baseline reads CSS variables, DTCG JSON and static Tailwind themes. It never executes config code. Dynamic functions, plugins or computed values need static token input instead. Relative units are kept as written. Taste axes that can be checked from tokens alone are reported separately from axes that need rendered HTML. `unchecked` does not mean passed.

Exit codes: 1 means a check failed, 2 means invalid input or references, and 3 means an approval is still pending.

## Local reproduction

`node scripts/screenshots.mjs` generates the inspiration board, variant comparison, before/after revision and share-page screenshots from original repository fixtures only. It writes them to `docs/screenshots/` by default and accepts no external site input. `node scripts/readme-hero.mjs` composes `docs/hero.png` from those screenshots and a fixture extraction. If browser permissions block screenshots, they are not generated, and that alone is not taken as visual acceptance.

Real-network smoke tests are not part of CI, and their output must stay outside the repository: `scripts/smoke-sites.mjs`, `scripts/smoke-galleries.mjs`, `scripts/smoke-browser.mjs`. Development verification is `npm test`; there is no extra build step.

## License

MIT. Run `npm run check:licenses` to check all dependencies; it uses `--excludePrivatePackages` to skip the private root package. The allowlist includes BlueOak-1.0.0. Existing dependencies also use Public Domain (jsonify), and the license checker's own dependencies use CC0-1.0 and CC-BY-3.0 (SPDX data). All dependency license and attribution notices are left unchanged.
