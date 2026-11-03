# design-from-sites

**Turn the sites you love into a design system you can trace.** An agent skill that votes out your taste first, then turns reference pages into design tokens where every value points back to the exact CSS line it came from.

[![CI](https://github.com/bmdy6/skill-design-from-sites/actions/workflows/ci.yml/badge.svg)](https://github.com/bmdy6/skill-design-from-sites/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) · [中文](README.zh-CN.md)

![Vote on references, get tokens with source receipts, compare three layouts, revise one part](docs/hero.png)

```sh
npx skills add bmdy6/skill-design-from-sites
```

Then tell your agent:

> Use design-from-sites. Here are two sites whose feel I like: `<url-1>` `<url-2>`. Help me pin down my taste and draft a landing page.

Node ≥ 20 · no API key · no hosted service · runs locally with Playwright + Chromium.

## Why this one

- **Tokens with receipts.** Every color, size and shadow carries its selector and stylesheet `line:column`. After building, the skill reopens the page and re-checks a sample of sources. The model only *names* things; it can only cite evidence IDs that already exist, so it can't invent values.
- **Taste before tokens.** You vote on what works (color, type, layout, whitespace…) before anything is extracted. Then you compare three layouts, pick one and circle the part to change. Each step waits for your explicit "yes".
- **Nothing copied.** Image, font, logo, SVG and video requests are blocked during collection. Previews use original placeholder blocks and local Lucide icons.

| | What it focuses on | How this project differs |
|---|---|---|
| dembrandt | Brand extraction and token export | Own Playwright/CDP collector that records selector and stylesheet line/column. No code reused. |
| getdesign / design.md | Design docs for agents | Numbers (evidence) and names (labels) are kept separate, and sources are re-verified |
| superdesign | Exploring multiple design options | Local pages and explicit gates. No hosted service. |

## Try it without an agent

```sh
git clone https://github.com/bmdy6/skill-design-from-sites && cd skill-design-from-sites
npm ci
node scripts/doctor.mjs --json     # installs Chromium if missing
node scripts/run.mjs extract --url https://example.com --out .design-from-sites
```

`extract` measures the page at desktop and mobile widths, then stops at `.design-from-sites/next.json`. From that point the host agent writes labels and the skill builds the tokens. [SKILL.md](SKILL.md) describes the full agent workflow. Every command, gate and exit code is listed in the [reference](docs/reference.md).

When tokens exist, lint your own code against them:

```sh
node scripts/check.mjs --tokens .design-from-sites/tokens.json --paths src --format json
```

Each off-token value is reported with its `file:line`, the nearest token and a suggested `var(--…)` replacement. Exit code 1 means findings.

## Personal and company mode

- **Personal** (`--mode personal`): at most five questions, then taste, tokens and drafts.
- **Company** (`--mode company`): starts from your existing page or code as the baseline. External inspiration is off by default and wireframes can't be skipped. Owner preferences come only from you.

Details: [reference → modes and approvals](docs/reference.md#modes-and-approvals).

## Scope and rights

Only collects public pages; it never reads logged-in sessions, cookies, an existing browser profile, agent memory or internal systems. It measures one page at two viewports and never crawls a site.

<details>
<summary>Copyright and trademark note (not legal advice)</summary>

Extracting computed styles from a public page does not grant any right to its design, trademarks, images or fonts. Check the target page's terms and the rules that apply to you. This project does not copy logos, copy text, images, font files or whole pages. Shareable output contains only source links, your own notes and CSS color swatches. See [reference → rights](docs/reference.md#copyright-and-trademark-not-legal-advice).

</details>

## Contributing

`npm test` runs the full suite (node:test). Browser tests need a machine that can launch Chromium. Repository images come only from original fixtures, rebuilt by `node scripts/screenshots.mjs` and `node scripts/readme-hero.mjs`.

MIT — see [LICENSE](LICENSE).
